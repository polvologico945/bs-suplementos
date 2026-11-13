import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function withLegacyDatabase(
  check: (db: PGlite, migration: string) => Promise<void>,
) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    `);
    const oldSchema = (
      await readFile("tests/fixtures/schema-v1.sql", "utf8")
    ).replace("create extension if not exists pgcrypto;", "");
    await db.exec(oldSchema);
    await check(db, await readFile("supabase/schema.sql", "utf8"));
  } finally {
    await db.close();
  }
}

// Estrutura legada criada manualmente: slug existe, mas sem UNIQUE.
const LEGACY_BRANDS = `create table public.brands (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null, description text, sort_order integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now()
);`;

describe("compatibilidade SQL com constraints ausentes", () => {
  it("reproduz 42710 no SQL v1 e reexecuta o schema atualizado com políticas existentes", async () => {
    await withLegacyDatabase(async (db, migration) => {
      const before = (
        await db.query(
          "select id,name,image_url from public.products order by id",
        )
      ).rows;
      const oldSchema = (
        await readFile("tests/fixtures/schema-v1.sql", "utf8")
      ).replace("create extension if not exists pgcrypto;", "");
      // Problema: o SQL antigo, ainda disponível na main, recria políticas sem
      // DROP/ALTER e gera o erro relatado. A reprodução fica em uma transação
      // revertida; depois verificamos o arquivo correto com os mesmos cadastros.
      // Data: 2026-11-13. @author Carla Evelyn
      await db.exec("begin;");
      try {
        await expect(db.exec(oldSchema)).rejects.toMatchObject({
          code: "42710",
          message:
            'policy "Public read active categories" for table "categories" already exists',
        });
      } finally {
        await db.exec("rollback;");
      }
      await db.exec(migration);
      await db.exec(migration);
      expect(
        (
          await db.query(
            "select id,name,image_url from public.products order by id",
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await db.query(
            "select policyname from pg_policies where schemaname='public' and tablename='categories' order by policyname",
          )
        ).rows,
      ).toEqual([
        { policyname: "Admin manages categories" },
        { policyname: "Public read active categories" },
      ]);
    });
  });
  it("acrescenta galerias sem regravar foto ou promoção legada pendente de revisão", async () => {
    await withLegacyDatabase(async (db, migration) => {
      await db.exec(
        "insert into public.products(name,image_url,price,promotional_price) values ('Foto preservada','foto-original.jpg',100,120);",
      );
      const before = (
        await db.query(
          "select id,image_url,updated_at from public.products where name='Foto preservada'",
        )
      ).rows;
      await db.exec(migration);
      await db.exec(migration);
      expect(
        (
          await db.query(
            "select id,image_url,updated_at from public.products where name='Foto preservada'",
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await db.query(
            "select image_urls from public.products where name='Foto preservada'",
          )
        ).rows,
      ).toEqual([{ image_urls: [] }]);
    });
  });
  it("atualiza marcas sem UNIQUE(slug), cria o índice e reexecuta sem duplicar produtos ou marcas", async () => {
    await withLegacyDatabase(async (db, migration) => {
      await db.exec(LEGACY_BRANDS);
      const products = (
        await db.query("select id,name from public.products order by id")
      ).rows;
      await db.exec(migration);
      const brands = (
        await db.query("select id,name,slug from public.brands order by id")
      ).rows;
      expect(brands.length).toBeGreaterThan(0);
      expect(
        (
          await db.query(
            "select indisunique from pg_index where indexrelid='public.catalog_brands_slug_unique'::regclass",
          )
        ).rows,
      ).toEqual([{ indisunique: true }]);
      await db.exec(migration);
      expect(
        (await db.query("select id,name from public.products order by id"))
          .rows,
      ).toEqual(products);
      expect(
        (await db.query("select id,name,slug from public.brands order by id"))
          .rows,
      ).toEqual(brands);
    });
  });

  it("preserva a configuração existente quando store_settings não possui PK/UNIQUE em id", async () => {
    await withLegacyDatabase(async (db, migration) => {
      await db.exec(
        "alter table public.store_settings drop constraint store_settings_pkey; update public.store_settings set store_name='Loja existente';",
      );
      await db.exec(migration);
      await db.exec(migration);
      expect(
        (await db.query("select id,store_name from public.store_settings"))
          .rows,
      ).toEqual([{ id: 1, store_name: "Loja existente" }]);
    });
  });

  it("preserva slugs repetidos, IDs e vínculos existentes e escolhe novos vínculos de forma estável", async () => {
    await withLegacyDatabase(async (db, migration) => {
      await db.exec(LEGACY_BRANDS);
      await db.exec(`
        insert into public.brands(id,name,slug,active) values
          ('20000000-0000-0000-0000-000000000001','Duplicada','repetido',false),
          ('20000000-0000-0000-0000-000000000002','Duplicada','repetido',true);
        alter table public.products add column brand_id uuid;
        insert into public.products(name,brand,brand_id) values
          ('Vínculo existente','Duplicada','20000000-0000-0000-0000-000000000001'),
          ('Vínculo novo','duplicada',null);
      `);
      const before = (
        await db.query(
          "select id,name,slug,active from public.brands order by id",
        )
      ).rows;
      await db.exec(migration);
      const count = (
        await db.query("select count(*) as count from public.brands")
      ).rows;
      await db.exec(migration);
      expect(
        (
          await db.query(
            "select id,name,slug,active from public.brands where slug='repetido' order by id",
          )
        ).rows,
      ).toEqual(before);
      expect(
        (await db.query("select count(*) as count from public.brands")).rows,
      ).toEqual(count);
      expect(
        (
          await db.query(
            "select name,brand_id from public.products where name like 'Vínculo%' order by name",
          )
        ).rows,
      ).toEqual([
        {
          name: "Vínculo existente",
          brand_id: "20000000-0000-0000-0000-000000000001",
        },
        {
          name: "Vínculo novo",
          brand_id: "20000000-0000-0000-0000-000000000002",
        },
      ]);
    });
  });
});
