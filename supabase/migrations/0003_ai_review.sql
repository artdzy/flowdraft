-- flowdraft: bağlı AI araçlarının (MCP) ekrandaki akışı görmesi ve kritiğini akışın üstüne yazması.
--
-- live_canvas: kullanıcının flowdraft'ta şu an açık olan tuvali (kaydedilmemiş değişiklikler dahil) ve küçük bir
--   önizleme görseli. Kullanıcı başına tek satır; sadece hesabına bir AI aracı bağlıysa uygulama tarafından yazılır.
-- reviews: AI aracının add_review ile bıraktığı kritik. Uygulama Realtime ile dinler ve akışın üstünde gösterir.
-- Ayrıca projects Realtime'a eklenir: AI akışı güncelleyince açık ekran yenilemeden son hali yükler.

create table if not exists public.live_canvas (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete set null,
  title       text not null default '',
  content     jsonb not null default '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  dirty       boolean not null default false,
  preview     text,
  preview_at  timestamptz,
  updated_at  timestamptz not null default now(),

  constraint live_canvas_title_len check (char_length(title) <= 120),
  constraint live_canvas_content_object check (jsonb_typeof(content) = 'object'),
  constraint live_canvas_content_size check (pg_column_size(content) <= 512 * 1024),
  constraint live_canvas_no_images check (position('data:image' in content::text) = 0),
  constraint live_canvas_preview_format check (preview is null or preview ~ '^data:image/(jpeg|png);base64,[A-Za-z0-9+/=]+$'),
  constraint live_canvas_preview_size check (preview is null or char_length(preview) <= 2 * 1024 * 1024)
);

alter table public.live_canvas enable row level security;

drop policy if exists "live_canvas_select_own" on public.live_canvas;
create policy "live_canvas_select_own" on public.live_canvas
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "live_canvas_insert_own" on public.live_canvas;
create policy "live_canvas_insert_own" on public.live_canvas
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "live_canvas_update_own" on public.live_canvas;
create policy "live_canvas_update_own" on public.live_canvas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "live_canvas_delete_own" on public.live_canvas;
create policy "live_canvas_delete_own" on public.live_canvas
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.live_canvas from anon;
grant select, insert, update, delete on public.live_canvas to authenticated;

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- null: kaydedilmemiş (henüz projesi olmayan) açık tuval için bırakılmış kritik.
  project_id  uuid references public.projects (id) on delete cascade,
  summary     text not null default '',
  items       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),

  constraint reviews_summary_len check (char_length(summary) <= 2000),
  constraint reviews_items_array check (jsonb_typeof(items) = 'array'),
  constraint reviews_items_size check (pg_column_size(items) <= 64 * 1024)
);

create index if not exists reviews_user_project_idx
  on public.reviews (user_id, project_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "reviews_select_own" on public.reviews;
create policy "reviews_select_own" on public.reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Kaydedilmemiş tuvale bırakılan kritik, tuval ilk kez kaydedilince o projeye taşınır (sadece project_id değişebilir).
drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.reviews from anon;
grant select, insert, delete on public.reviews to authenticated;
grant update (project_id) on public.reviews to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews'
    ) then
      alter publication supabase_realtime add table public.reviews;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
    ) then
      alter publication supabase_realtime add table public.projects;
    end if;
  end if;
end;
$$;
