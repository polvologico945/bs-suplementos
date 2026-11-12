import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const admin = "10000000-0000-0000-0000-000000000001";
const viewer = "10000000-0000-0000-0000-000000000002";
let db: PGlite;
const query = (sql: string) => db.query(sql);

beforeAll(async () => {
  db = new PGlite();
  // Simula os schemas gerenciados do Supabase; o SQL da aplicação é executado sem mocks.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    insert into auth.users values ('${admin}', 'admin@example.test'), ('${viewer}', 'viewer@example.test');
  `);
  await db.exec(await readFile("supabase/schema.sql", "utf8"));
  await db.exec(
    `insert into public.profiles values ('${admin}', 'admin', now()), ('${viewer}', 'viewer', now());`,
  );
});
afterAll(async () => {
  await db.close();
});

describe("SQL, relações e RLS em PostgreSQL", () => {
  it("reexecuta sem duplicar dados e sem perder cadastros", async () => {
    await db.exec(
      "insert into public.categories (name,slug) values ('Suplementos','suplementos'); insert into public.products (name,brand,price) values ('Creatina','Marca antiga',80);",
    );
    const sql = await readFile("supabase/schema.sql", "utf8");
    await db.exec(sql);
    await db.exec(sql);
    const { rows } = await query(
      "select p.name,p.price,b.name as brand from public.products p left join public.brands b on p.brand_id=b.id",
    );
    expect(rows).toEqual([
      { name: "Creatina", price: "80.00", brand: "Marca antiga" },
    ]);
  });
  it("impede escrita anônima e esconde produtos inativos", async () => {
    await db.exec(
      "insert into public.products(name,active) values ('Oculto',false); set role anon;",
    );
    expect((await query("select name from public.products")).rows).toEqual([
      { name: "Creatina" },
    ]);
    await expect(
      query("insert into public.products(name) values ('Invasão')"),
    ).rejects.toThrow();
    await db.exec("reset role;");
  });
  it("não permite elevar o próprio perfil ou gravar como viewer", async () => {
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${viewer}';`,
    );
    await expect(
      query("update public.profiles set role='admin'"),
    ).rejects.toThrow();
    await expect(
      query(
        "insert into public.brands(name,slug) values ('Invasão','invasao')",
      ),
    ).rejects.toThrow();
    await expect(
      query(
        "insert into storage.objects(bucket_id,name) values ('catalog','invasao.webp')",
      ),
    ).rejects.toThrow();
    await db.exec("reset role;");
  });
  it("permite CRUD ao admin e protege relações entre tipo e categoria", async () => {
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${admin}';`,
    );
    await db.exec(
      "insert into public.categories(name,slug) values ('Alimentos','alimentos'); insert into public.product_types(category_id,name,slug) select id,'Whey','whey' from public.categories where slug='suplementos';",
    );
    await expect(
      query(
        "insert into public.products(name,category_id,product_type_id) select 'Tipo errado',c.id,t.id from public.categories c cross join public.product_types t where c.slug='alimentos'",
      ),
    ).rejects.toThrow(/categoria/);
    await db.exec(
      "insert into public.products(name,category_id,product_type_id,flavors,price,promotional_price) select 'Whey',category_id,id,array['Chocolate'],100,90 from public.product_types;",
    );
    await expect(
      query(
        "update public.products set promotional_price=120 where name='Whey'",
      ),
    ).rejects.toThrow();
    await db.exec(
      "insert into storage.objects(bucket_id,name) values ('catalog','products/test.webp'); delete from public.product_types where slug='whey';",
    );
    expect(
      (
        await query(
          "select product_type_id from public.products where name='Whey'",
        )
      ).rows,
    ).toEqual([{ product_type_id: null }]);
    await db.exec("reset role;");
  });
});

describe("exclusão de categorias", () => {
  it("preserva o produto e limpa categoria/tipo sem conflito entre triggers e FKs", async () => {
    await db.exec(`insert into public.categories(name,slug) values ('Excluir','excluir');
      insert into public.product_types(category_id,name,slug) select id,'Tipo','tipo' from public.categories where slug='excluir';
      insert into public.products(name,category_id,product_type_id) select 'Preservado',category_id,id from public.product_types where slug='tipo';
      delete from public.categories where slug='excluir';`);
    expect(
      (
        await query(
          "select category_id,product_type_id from public.products where name='Preservado'",
        )
      ).rows,
    ).toEqual([{ category_id: null, product_type_id: null }]);
  });
});

describe("migração do banco anterior", () => {
  it("adiciona marcas, tipos e sabores sem apagar produtos do schema v1", async () => {
    const legacy = new PGlite();
    try {
      await legacy.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
        create table auth.users(id uuid primary key, email text);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);`);
      const v1 = (
        await readFile("tests/fixtures/schema-v1.sql", "utf8")
      ).replace("create extension if not exists pgcrypto;", "");
      await legacy.exec(v1);
      const before = (
        await legacy.query("select id,name from public.products order by id")
      ).rows;
      const sql = await readFile("supabase/schema.sql", "utf8");
      await legacy.exec(sql);
      await legacy.exec(sql);
      expect(
        (await legacy.query("select id,name from public.products order by id"))
          .rows,
      ).toEqual(before);
      expect(
        (
          await legacy.query(
            "select count(*)::int as count from public.products where brand_id is not null and flavors = '{}'::text[]",
          )
        ).rows,
      ).toEqual([{ count: before.length }]);
    } finally {
      await legacy.close();
    }
  });
});
