-- ISOPoz — Migration 0007 : ciblage des notifications
-- Exécuter après 0006. Idempotent.

-- Renvoie les user_id ayant une permission effective donnée
-- (super admin OU via rôles, moins les refus, plus les grants individuels).
create or replace function public.users_with_permission(perm text)
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.users where is_super_admin = true and status = 'active'
  union
  select ur.user_id
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  join public.users u on u.id = ur.user_id
  where p.key = perm and u.status = 'active'
    and not exists (
      select 1 from public.user_permissions up
      join public.permissions p2 on p2.id = up.permission_id
      where up.user_id = ur.user_id and p2.key = perm and up.granted = false
    )
  union
  select up.user_id
  from public.user_permissions up
  join public.permissions p on p.id = up.permission_id
  join public.users u on u.id = up.user_id
  where p.key = perm and up.granted = true and u.status = 'active';
$$;
