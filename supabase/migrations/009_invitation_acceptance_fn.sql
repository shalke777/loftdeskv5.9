create or replace function public.accept_company_invitation(invite_token text)
returns uuid
language plpgsql
security definer
as $$
declare
  invite_row public.company_invitations%rowtype;
  cur_user uuid;
begin
  cur_user := auth.uid();
  if cur_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into invite_row
  from public.company_invitations
  where token = invite_token
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if invite_row.id is null then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  insert into public.company_members(company_id, user_id, role)
  values (invite_row.company_id, cur_user, invite_row.role)
  on conflict (company_id, user_id) do update set role = excluded.role;

  update public.company_invitations
  set status = 'accepted'
  where id = invite_row.id;

  return invite_row.company_id;
end;
$$;
