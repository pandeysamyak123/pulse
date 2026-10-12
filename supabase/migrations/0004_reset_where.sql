-- pg_safeupdate (enabled for API roles) rejects DELETE without WHERE.
create or replace function reset_demo_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'arjun', true);
  perform set_config('app.allow_reset', 'on', true);
  delete from email_runs where true;
  delete from score_history where true;
  delete from scan_runs where true;
  delete from accounts where true;   -- cascades to every per-account table
end $$;
