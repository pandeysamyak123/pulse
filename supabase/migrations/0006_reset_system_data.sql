-- Wipes everything Pulse found (SYSTEM data only) so a scan can start fresh.
-- Arjun's data is untouched — the integrity hash is identical before/after.
create or replace function reset_system_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'system', true);
  delete from outreach_drafts where true;
  delete from note_digests where true;
  delete from score_history where true;
  delete from scan_runs where true;
  delete from articles where true;  -- cascades to signals
  update accounts set
    warmth_score = 0, warmth_tier = 'quiet', score_trend = 'steady', score_breakdown = '[]',
    top_signal_id = null, signal_summary = null, why_now = null, outreach_angle = null,
    company_brief = null, recommended_contact_id = null, recommended_contact_reason = null,
    signals_last_3d = 0, signals_last_14d = 0, last_signal_at = null, last_scanned_at = null
  where true;
end $$;
revoke execute on function reset_system_data() from public, anon, authenticated;
grant execute on function reset_system_data() to service_role;
