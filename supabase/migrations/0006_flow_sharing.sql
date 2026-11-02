-- flowdraft: akış paylaşımı (web). Sahip bir akışı /s/<token> linkiyle paylaşır.
--
-- flow_shares: akış başına tek link. public: linki bilen okur; private: linki bilen şifreyle okur.
-- flow_members: e-postayla eklenen kişiler. viewer okur; editor düzenler. Düzenleme yalnızca bu tablodan gelir,
--   link hiçbir zaman düzenleme yetkisi vermez.
-- İki tabloya da istemciden erişilemez: şifre özeti dışarı çıkmaz, her şey aşağıdaki fonksiyonlardan geçer.
--
-- E-posta onayı kapalıyken (autoconfirm) bir adresi kimin kaydettiği kanıtlanamaz: var olan bir hesabın adresi tekrar
-- alınamaz, ama henüz hesabı olmayan bir adrese yapılan daveti, o adresle ilk kaydolan alır. E-posta onayı açılınca bu
-- boşluk kapanır.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.flow_shares (
  project_id       uuid primary key references public.projects (id) on delete cascade,
  token            text not null unique default replace(gen_random_uuid()::text, '-', ''),
  visibility       text not null default 'public',
  password_hash    text,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint flow_shares_visibility check (visibility in ('public', 'private'))
);

create table if not exists public.flow_members (
  project_id  uuid not null references public.flow_shares (project_id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer',
  created_at  timestamptz not null default now(),

  primary key (project_id, email),
  constraint flow_members_email check (email = lower(email) and char_length(email) between 3 and 254),
  constraint flow_members_role check (role in ('viewer', 'editor'))
);

create index if not exists flow_members_email_idx on public.flow_members (email);

alter table public.flow_shares enable row level security;
alter table public.flow_members enable row level security;
revoke all on public.flow_shares from public, anon, authenticated;
revoke all on public.flow_members from public, anon, authenticated;

create or replace function public.current_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email::text) from auth.users u where u.id = (select auth.uid());
$$;

-- Oturum sahibinin e-postayla eklendiği rol; eklenmemişse null.
create or replace function public.my_flow_role(flow uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.flow_members m where m.project_id = flow and m.email = public.current_email();
$$;

create or replace function public.require_flow_owner(flow uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects p where p.id = flow and p.user_id = (select auth.uid())) then
    raise exception 'not flow owner' using errcode = '42501';
  end if;
end;
$$;

-- Editörler akışı mevcut istemci yoluyla okuyup kaydeder (projects tablosu, Realtime dahil).
drop policy if exists "projects_select_editor" on public.projects;
create policy "projects_select_editor" on public.projects
  for select to authenticated
  using (public.my_flow_role(id) = 'editor');

drop policy if exists "projects_update_editor" on public.projects;
create policy "projects_update_editor" on public.projects
  for update to authenticated
  using (public.my_flow_role(id) = 'editor')
  with check (public.my_flow_role(id) = 'editor');

-- Editör satırı güncelleyebildiğine göre sahipliği alamamalı: istemci sadece bu iki sütunu değiştirebilir.
revoke update on public.projects from authenticated;
grant update (title, content) on public.projects to authenticated;

create or replace function public.get_flow_share(flow uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  share public.flow_shares;
begin
  perform public.require_flow_owner(flow);
  select * into share from public.flow_shares s where s.project_id = flow;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'token', share.token,
    'visibility', share.visibility,
    'has_password', share.password_hash is not null,
    'members', coalesce(
      (select jsonb_agg(jsonb_build_object('email', m.email, 'role', m.role) order by m.created_at, m.email)
       from public.flow_members m where m.project_id = flow),
      '[]'::jsonb
    )
  );
end;
$$;

-- new_password null ise mevcut şifre kalır. Üyeler verilen listeyle değiştirilir.
create or replace function public.save_flow_share(flow uuid, new_visibility text, new_password text, new_members jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  hash text;
begin
  perform public.require_flow_owner(flow);
  if new_visibility not in ('public', 'private') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  if jsonb_typeof(new_members) <> 'array' or jsonb_array_length(new_members) > 50 then
    raise exception 'too many members' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(new_members) as x(email text, role text)
    where x.email is null
      or trim(x.email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      or char_length(trim(x.email)) > 254
      or x.role is null
      or x.role not in ('viewer', 'editor')
  ) then
    raise exception 'invalid member' using errcode = '22023';
  end if;

  select s.password_hash into hash from public.flow_shares s where s.project_id = flow;
  if new_visibility = 'public' then
    hash := null;
  elsif new_password is not null then
    if char_length(new_password) < 4 or octet_length(new_password) > 72 then
      raise exception 'invalid share password' using errcode = '22023';
    end if;
    hash := extensions.crypt(new_password, extensions.gen_salt('bf', 10));
  end if;
  if new_visibility = 'private' and hash is null and jsonb_array_length(new_members) = 0 then
    raise exception 'share password required' using errcode = '22023';
  end if;

  insert into public.flow_shares (project_id, visibility, password_hash)
  values (flow, new_visibility, hash)
  on conflict (project_id) do update
    set visibility = excluded.visibility,
        password_hash = excluded.password_hash,
        failed_attempts = 0,
        locked_until = null,
        updated_at = now();

  delete from public.flow_members m where m.project_id = flow;
  insert into public.flow_members (project_id, email, role)
  select flow, lower(trim(x.email)), min(x.role)
  from jsonb_to_recordset(new_members) as x(email text, role text)
  group by lower(trim(x.email));

  return public.get_flow_share(flow);
end;
$$;

create or replace function public.stop_flow_share(flow uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_flow_owner(flow);
  delete from public.flow_shares s where s.project_id = flow;
end;
$$;

-- Linki açar; anonim de çağırabilir. Yanlış şifre hata fırlatmaz: fırlatsa deneme sayacı da geri alınırdı.
-- 10 yanlış denemeden sonra link 15 dakika şifre kabul etmez.
create or replace function public.open_shared_flow(share_token text, pass text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  share public.flow_shares;
  flow public.projects;
  access text;
begin
  select * into share from public.flow_shares s where s.token = share_token;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into flow from public.projects p where p.id = share.project_id;

  access := case when flow.user_id = (select auth.uid()) then 'owner' else public.my_flow_role(flow.id) end;

  if access is null and share.visibility = 'private' then
    if share.password_hash is null then
      return jsonb_build_object('status', 'invite_only');
    end if;
    if pass is null or pass = '' then
      return jsonb_build_object('status', 'password');
    end if;
    if share.locked_until > now() then
      return jsonb_build_object('status', 'locked');
    end if;
    if octet_length(pass) > 72 or extensions.crypt(pass, share.password_hash) <> share.password_hash then
      update public.flow_shares s
        set failed_attempts = case when s.failed_attempts >= 9 then 0 else s.failed_attempts + 1 end,
            locked_until = case when s.failed_attempts >= 9 then now() + interval '15 minutes' else s.locked_until end
        where s.project_id = share.project_id;
      return jsonb_build_object('status', 'wrong_password');
    end if;
    if share.failed_attempts > 0 then
      update public.flow_shares s set failed_attempts = 0 where s.project_id = share.project_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'title', flow.title,
    'content', flow.content,
    'updated_at', flow.updated_at,
    'role', coalesce(access, 'link'),
    -- Düzenleyebilene akışın kimliği verilir; ?p=<id> ile editörde açılır.
    'project_id', case when access in ('owner', 'editor') then flow.id end
  );
end;
$$;

create or replace function public.shared_with_me()
returns table (
  id          uuid,
  title       text,
  updated_at  timestamptz,
  role        text,
  token       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.title, p.updated_at, m.role, s.token
  from public.flow_members m
  join public.flow_shares s on s.project_id = m.project_id
  join public.projects p on p.id = m.project_id
  where m.email = public.current_email() and p.user_id <> (select auth.uid())
  order by p.updated_at desc
  limit 200;
$$;

revoke execute on function public.current_email() from public, anon;
revoke execute on function public.my_flow_role(uuid) from public, anon;
revoke execute on function public.require_flow_owner(uuid) from public, anon, authenticated;
revoke execute on function public.get_flow_share(uuid) from public, anon;
revoke execute on function public.save_flow_share(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.stop_flow_share(uuid) from public, anon;
revoke execute on function public.open_shared_flow(text, text) from public;
revoke execute on function public.shared_with_me() from public, anon;
grant execute on function public.current_email() to authenticated;
grant execute on function public.my_flow_role(uuid) to authenticated;
grant execute on function public.get_flow_share(uuid) to authenticated;
grant execute on function public.save_flow_share(uuid, text, text, jsonb) to authenticated;
grant execute on function public.stop_flow_share(uuid) to authenticated;
grant execute on function public.open_shared_flow(text, text) to anon, authenticated;
grant execute on function public.shared_with_me() to authenticated;
