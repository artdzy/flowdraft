-- flowdraft: bağlı AI araçlarının (MCP) flowdraft'ta açık olan akışı görmesi ve değişikliklerin ekrana canlı gelmesi.
--
-- live_canvas: kullanıcının flowdraft'ta şu an açık olan tuvali (kaydedilmemiş değişiklikler dahil). Kullanıcı başına
--   tek satır; sadece hesabına bir AI aracı bağlıysa ve paylaşım açıksa uygulama tarafından yazılır (get_open_diagram).
-- Ayrıca projects Realtime'a eklenir: AI akışı güncelleyince açık ekran yenilemeden son hali yükler.

create table if not exists public.live_canvas (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete set null,
  title       text not null default '',
  content     jsonb not null default '{"version":1,"nodes":[],"edges":[]}'::jsonb,
  dirty       boolean not null default false,
  updated_at  timestamptz not null default now(),

  constraint live_canvas_title_len check (char_length(title) <= 120),
  constraint live_canvas_content_object check (jsonb_typeof(content) = 'object'),
  constraint live_canvas_content_size check (pg_column_size(content) <= 512 * 1024),
  constraint live_canvas_no_images check (position('data:image' in content::text) = 0)
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

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
    ) then
      alter publication supabase_realtime add table public.projects;
    end if;
  end if;
end;
$$;
