-- flowdraft: yönetici paneli (/yonetim). Üyeleri ve akışlarının başlıklarını salt okunur listeler.
-- Akış içeriği (content) hiçbir yönetici fonksiyonundan dönmez.

-- Yöneticiler e-posta ile değil kullanıcı kimliği ile tanımlanır: e-posta onayı kapalıyken
-- (autoconfirm) bir adresi kimin kaydettiği kanıtlanamaz.
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Politika yok: tabloya istemciden erişilemez, sadece aşağıdaki fonksiyonlar okur.
alter table public.admins enable row level security;
revoke all on public.admins from public, anon, authenticated;

-- AI araçlarına (MCP / OAuth) verilen oturumlar yönetici sayılmaz; onların jetonunda client_id bulunur.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
    and ((select auth.jwt()) ->> 'client_id') is null;
$$;

create or replace function public.admin_list_members()
returns table (
  id               uuid,
  email            text,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  flow_count       bigint,
  last_flow_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, count(p.id), max(p.updated_at)
    from auth.users u
    left join public.projects p on p.user_id = u.id
    group by u.id
    order by u.created_at desc;
end;
$$;

create or replace function public.admin_list_member_flows(member uuid)
returns table (
  id          uuid,
  title       text,
  node_count  integer,
  created_at  timestamptz,
  updated_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select
      p.id,
      p.title,
      case when jsonb_typeof(p.content -> 'nodes') = 'array' then jsonb_array_length(p.content -> 'nodes') else 0 end,
      p.created_at,
      p.updated_at
    from public.projects p
    where p.user_id = member
    order by p.updated_at desc;
end;
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_list_members() from public, anon;
revoke execute on function public.admin_list_member_flows(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_list_members() to authenticated;
grant execute on function public.admin_list_member_flows(uuid) to authenticated;

-- İlk yönetici. Hesap bu dosya çalıştırılmadan önce açılmış olmalı; yoksa satır eklenmez.
-- Başka birini yönetici yapmak için aynı insert'i onun e-postasıyla SQL Editor'de çalıştır.
insert into public.admins (user_id)
select id from auth.users where email = 'merhaba@flowdraft.tech'
on conflict do nothing;
