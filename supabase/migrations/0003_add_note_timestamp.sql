-- add_note gains an optional timestamp (used by the seed to backdate history).
drop function if exists add_note(uuid, text, boolean);

create or replace function add_note(p_account_id uuid, p_body text, p_pinned boolean default false,
                                    p_created_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform set_config('app.actor', 'arjun', true);
  insert into notes (account_id, body, pinned, created_at)
  values (p_account_id, p_body, p_pinned, coalesce(p_created_at, now()))
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function add_note(uuid, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function add_note(uuid, text, boolean, timestamptz) to service_role;
