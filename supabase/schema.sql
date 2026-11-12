-- Instalação e atualização aditiva do catálogo. Executar o arquivo inteiro no SQL Editor.
-- Problema: painel e banco divergiam em marcas, tipos e sabores; reexecuções também
-- duplicavam produtos de exemplo. Mantém cadastros/fotos existentes e não insere
-- produtos fictícios. Transação cancela tudo se alguma instrução falhar.
-- Data: 2026-11-12. @author Carla Evelyn
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  brand text,
  description text,
  price numeric(10,2) check (price is null or price >= 0),
  promotional_price numeric(10,2) check (promotional_price is null or promotional_price >= 0),
  image_url text,
  active boolean not null default true,
  featured boolean not null default false,
  stock_status text not null default 'available' check (stock_status in ('available','low','unavailable')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'BS Suplementos',
  tagline text not null default 'Performance, saúde e os melhores suplementos em Baturité.',
  whatsapp text not null default '5585991665030',
  instagram text,
  address text,
  logo_url text,
  hero_image_url text,
  primary_color text not null default '#07883d',
  accent_color text not null default '#c32222',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id, instagram, address, logo_url, hero_image_url)
values (1, '@bio.suplementos', 'Avenida Sete de Setembro, 848 — Centro — Baturité/CE', '/brand/logo-card.jpg', '/brand/card-front.jpg')
on conflict (id) do nothing;


create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

alter table public.products add column if not exists brand_id uuid;
alter table public.products add column if not exists product_type_id uuid;
alter table public.products add column if not exists flavors text[] not null default '{}';
alter table public.brands add column if not exists updated_at timestamptz not null default now();
alter table public.product_types add column if not exists updated_at timestamptz not null default now();

-- Instala FKs também quando as colunas já foram criadas manualmente em produção.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and contype = 'f' and confrelid = 'public.brands'::regclass) then
    alter table public.products add constraint products_brand_id_fkey foreign key (brand_id) references public.brands(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and contype = 'f' and confrelid = 'public.product_types'::regclass) then
    alter table public.products add constraint products_product_type_id_fkey foreign key (product_type_id) references public.product_types(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.product_types'::regclass and contype = 'f' and confrelid = 'public.categories'::regclass) then
    alter table public.product_types add constraint product_types_category_id_fkey foreign key (category_id) references public.categories(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_promotion_valid') then
    -- NOT VALID preserva eventual cadastro legado inválido; toda nova escrita é validada.
    alter table public.products add constraint products_promotion_valid check (promotional_price is null or (price is not null and promotional_price < price)) not valid;
  end if;
end $$;

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_type_idx on public.products(product_type_id);
create index if not exists products_brand_idx on public.products(brand_id);
create index if not exists products_catalog_idx on public.products(sort_order, name) where active;
create index if not exists product_types_category_idx on public.product_types(category_id);

-- Migra nomes legados sem apagar o campo de compatibilidade nem substituir IDs existentes.
insert into public.brands(name, slug)
select min(trim(p.brand)), 'marca-' || md5(lower(trim(p.brand)))
from public.products p
where nullif(trim(p.brand), '') is not null
  and not exists (select 1 from public.brands b where lower(trim(b.name)) = lower(trim(p.brand)))
group by lower(trim(p.brand))
on conflict (slug) do nothing;

update public.products p set brand_id = b.id
from public.brands b
where p.brand_id is null and lower(trim(p.brand)) = lower(trim(b.name));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.catalog_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

-- Evita associar um tipo de outra categoria e mantém o nome legado da marca coerente.
create or replace function public.catalog_product_relations()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.product_type_id is not null and not exists (
    select 1 from public.product_types where id = new.product_type_id and category_id = new.category_id
  ) then
    -- A categoria pode ser desvinculada por FK durante uma exclusão. Limpa o tipo
    -- anterior no mesmo evento, antes de validar, preservando o produto.
    if tg_op = 'UPDATE' and new.category_id is distinct from old.category_id
      and new.product_type_id is not distinct from old.product_type_id then
      new.product_type_id = null;
    else raise exception 'O tipo de produto deve pertencer à categoria selecionada.';
    end if;
  end if;
  if new.brand_id is not null then
    select name into new.brand from public.brands where id = new.brand_id;
  elsif tg_op = 'UPDATE' and old.brand_id is not null then
    new.brand = null;
  end if;
  new.flavors = coalesce(new.flavors, '{}');
  return new;
end $$;
drop trigger if exists catalog_product_relations on public.products;
create trigger catalog_product_relations before insert or update on public.products for each row execute function public.catalog_product_relations();

create or replace function public.catalog_type_category()
returns trigger language plpgsql set search_path = ''
as $$ begin
  if new.category_id is distinct from old.category_id and exists (
    select 1 from public.products where product_type_id = old.id and category_id is distinct from new.category_id
  ) then raise exception 'Mova os produtos vinculados antes de alterar a categoria do tipo.'; end if;
  return new;
end $$;
drop trigger if exists catalog_type_category on public.product_types;
create trigger catalog_type_category before update on public.product_types for each row execute function public.catalog_type_category();

-- Apenas as políticas conhecidas desta aplicação são substituídas. Políticas adicionais
-- de produção precisam ser revisadas separadamente, pois permissões RLS se somam.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.product_types enable row level security;
alter table public.brands enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "User reads own profile" on public.profiles;
create policy "User reads own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));

do $$
declare tab text;
begin
  foreach tab in array array['categories','products','product_types','brands'] loop
    execute format('drop policy if exists %I on public.%I', 'Public read active ' || tab, tab);
    execute format('drop policy if exists %I on public.%I', 'Admin manages ' || tab, tab);
    execute format('create policy %I on public.%I for select to anon, authenticated using (active or (select public.is_admin()))', 'Public read active ' || tab, tab);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', 'Admin manages ' || tab, tab);
    execute format('grant select on public.%I to anon, authenticated', tab);
    execute format('grant insert, update, delete on public.%I to authenticated', tab);
    execute format('drop trigger if exists catalog_updated_at on public.%I', tab);
    execute format('create trigger catalog_updated_at before update on public.%I for each row execute function public.catalog_updated_at()', tab);
  end loop;
end $$;

drop policy if exists "Public reads store settings" on public.store_settings;
drop policy if exists "Admin updates store settings" on public.store_settings;
create policy "Public reads store settings" on public.store_settings for select to anon, authenticated using (true);
create policy "Admin updates store settings" on public.store_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
grant select on public.profiles to authenticated;
drop trigger if exists catalog_updated_at on public.store_settings;
create trigger catalog_updated_at before update on public.store_settings for each row execute function public.catalog_updated_at();

-- As fotos HEIC/JPEG são convertidas no navegador; o Storage guarda só formatos
-- universais. Não é necessário liberar HEIC ou GIF no bucket público.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog','catalog',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public reads catalog images" on storage.objects;
drop policy if exists "Admin uploads catalog images" on storage.objects;
drop policy if exists "Admin updates catalog images" on storage.objects;
drop policy if exists "Admin deletes catalog images" on storage.objects;
create policy "Public reads catalog images" on storage.objects for select to anon, authenticated using (bucket_id='catalog');
create policy "Admin uploads catalog images" on storage.objects for insert to authenticated with check (bucket_id='catalog' and (select public.is_admin()));
create policy "Admin updates catalog images" on storage.objects for update to authenticated using (bucket_id='catalog' and (select public.is_admin())) with check (bucket_id='catalog' and (select public.is_admin()));
create policy "Admin deletes catalog images" on storage.objects for delete to authenticated using (bucket_id='catalog' and (select public.is_admin()));

comment on table public.products is 'Catálogo v2 — 2026-11-12 — Carla Evelyn';
notify pgrst, 'reload schema';
commit;

-- Depois de criar o administrador em Authentication > Users, executar separadamente:
-- insert into public.profiles (id, role)
-- select id, 'admin' from auth.users where email = 'EMAIL_DO_ADMIN@EXEMPLO.COM'
-- on conflict (id) do update set role='admin';
