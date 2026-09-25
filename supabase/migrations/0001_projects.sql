-- flowdraft: kullanıcıya ait akış projeleri.
-- İçerik sadece düğüm/bağlantı JSON'u; görsel (data:image) ve büyük yükler reddedilir.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'Adsız akış',
  content     jsonb not null default '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint projects_title_len check (char_length(title) between 1 and 120),
  constraint projects_content_object check (jsonb_typeof(content) = 'object'),
  constraint projects_content_size check (pg_column_size(content) <= 512 * 1024),
  constraint projects_no_images check (position('data:image' in content::text) = 0)
);

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

create or replace function public.projects_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.projects_touch_updated_at();

-- Kullanıcı başına en fazla 200 proje.
create or replace function public.projects_enforce_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.projects p where p.user_id = new.user_id) >= 200 then
    raise exception 'project quota exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_enforce_quota on public.projects;
create trigger projects_enforce_quota
  before insert on public.projects
  for each row execute function public.projects_enforce_quota();

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
revoke execute on function public.projects_enforce_quota() from public, anon, authenticated;
