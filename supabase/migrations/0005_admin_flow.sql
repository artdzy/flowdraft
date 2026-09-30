-- flowdraft: yönetici panelinde bir akışı salt okunur açmak için içeriğini döndürür.
-- Gizlilik metninde (5. madde) işletmecinin destek ve kötüye kullanım incelemesi için akışları
-- görüntüleyebileceği yazılıdır.

create or replace function public.admin_get_flow(flow uuid)
returns table (
  id          uuid,
  title       text,
  content     jsonb,
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
    select p.id, p.title, p.content, p.updated_at
    from public.projects p
    where p.id = flow;
end;
$$;

revoke execute on function public.admin_get_flow(uuid) from public, anon;
grant execute on function public.admin_get_flow(uuid) to authenticated;
