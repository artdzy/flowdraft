-- flowdraft: kullanıcı hesabını uygulama içinden kalıcı olarak siler (App Store 5.1.1(v)).
-- auth.users satırı silinince projects satırları "on delete cascade" ile gider.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
