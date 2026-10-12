-- ════════════════════════════════════════════════════════════════════
-- Ownership enforcement — "automation never overwrites Arjun's data"
--
-- Layer 1  Single write path for automation: apply_signal_update() is the
--          ONLY way the pipeline touches `accounts`; it writes SYSTEM
--          columns only and runs as app.actor = 'system'.
-- Layer 2  Guard triggers: ARJUN columns/tables can only change when
--          app.actor = 'arjun' (set exclusively by Arjun's RPCs). Any other
--          actor — 'system', or a raw service-role .update() with no actor —
--          raises OWNERSHIP_VIOLATION.
-- Layer 3  UI write path: update_manual_fields / log_activity / add_note /
--          upsert_contact set app.actor = 'arjun' and touch ARJUN data only.
-- Layer 4  Proof: arjun_data_hash() before/after every scan, stored in
--          scan_runs; integrity_probe() demonstrates the guards fire.
-- ════════════════════════════════════════════════════════════════════

create or replace function current_actor() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('app.actor', true), ''), 'none')
$$;

-- ───────────── Layer 2: guard triggers ─────────────

create or replace function guard_accounts() returns trigger
language plpgsql as $$
declare
  actor text := current_actor();
  arjun_changed boolean;
  system_changed boolean;
begin
  if tg_op in ('INSERT','DELETE') then
    if actor <> 'arjun' then
      raise exception 'OWNERSHIP_VIOLATION: % on accounts requires actor arjun (actor=%)', tg_op, actor;
    end if;
    return coalesce(new, old);
  end if;

  arjun_changed :=
       new.company_name         is distinct from old.company_name
    or new.domain               is distinct from old.domain
    or new.industry             is distinct from old.industry
    or new.hq_city              is distinct from old.hq_city
    or new.employee_band        is distinct from old.employee_band
    or new.stage                is distinct from old.stage
    or new.search_aliases       is distinct from old.search_aliases
    or new.exclude_terms        is distinct from old.exclude_terms
    or new.last_contact_date    is distinct from old.last_contact_date
    or new.arjun_notes          is distinct from old.arjun_notes
    or new.relationship_read    is distinct from old.relationship_read
    or new.next_step            is distinct from old.next_step
    or new.next_step_due        is distinct from old.next_step_due
    or new.do_not_contact_until is distinct from old.do_not_contact_until;

  system_changed :=
       new.warmth_score     is distinct from old.warmth_score
    or new.warmth_tier      is distinct from old.warmth_tier
    or new.score_trend      is distinct from old.score_trend
    or new.score_breakdown  is distinct from old.score_breakdown
    or new.top_signal_id    is distinct from old.top_signal_id
    or new.signal_summary   is distinct from old.signal_summary
    or new.why_now          is distinct from old.why_now
    or new.outreach_angle   is distinct from old.outreach_angle
    or new.company_brief    is distinct from old.company_brief
    or new.recommended_contact_id     is distinct from old.recommended_contact_id
    or new.recommended_contact_reason is distinct from old.recommended_contact_reason
    or new.signals_last_3d  is distinct from old.signals_last_3d
    or new.signals_last_14d is distinct from old.signals_last_14d
    or new.last_signal_at   is distinct from old.last_signal_at
    or new.last_scanned_at  is distinct from old.last_scanned_at;

  if arjun_changed and actor <> 'arjun' then
    raise exception 'OWNERSHIP_VIOLATION: actor % attempted to modify ARJUN columns on accounts', actor;
  end if;
  if system_changed and actor <> 'system' then
    raise exception 'OWNERSHIP_VIOLATION: actor % attempted to modify SYSTEM columns on accounts', actor;
  end if;
  return new;
end $$;

create trigger trg_guard_accounts
  before insert or update or delete on accounts
  for each row execute function guard_accounts();

-- contacts / notes: only Arjun may insert, update or delete
create or replace function guard_arjun_table() returns trigger
language plpgsql as $$
begin
  if current_actor() <> 'arjun' then
    raise exception 'OWNERSHIP_VIOLATION: actor % attempted % on ARJUN table %',
      current_actor(), tg_op, tg_table_name;
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_guard_contacts before insert or update or delete on contacts
  for each row execute function guard_arjun_table();
create trigger trg_guard_notes before insert or update or delete on notes
  for each row execute function guard_arjun_table();

-- activities: Arjun-only and append-only (only outcome/note may be edited)
create or replace function guard_activities() returns trigger
language plpgsql as $$
begin
  if current_actor() <> 'arjun' then
    raise exception 'OWNERSHIP_VIOLATION: actor % attempted % on ARJUN table activities',
      current_actor(), tg_op;
  end if;
  if tg_op = 'DELETE' and current_setting('app.allow_reset', true) is distinct from 'on' then
    raise exception 'APPEND_ONLY: activities cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and (
       new.account_id  is distinct from old.account_id
    or new.contact_id  is distinct from old.contact_id
    or new.channel     is distinct from old.channel
    or new.direction   is distinct from old.direction
    or new.subject     is distinct from old.subject
    or new.body_sent   is distinct from old.body_sent
    or new.occurred_at is distinct from old.occurred_at
    or new.created_via is distinct from old.created_via) then
    raise exception 'APPEND_ONLY: only outcome and note may change on an activity';
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_guard_activities before insert or update or delete on activities
  for each row execute function guard_activities();

-- ───────────── Layer 1: the pipeline's single write path ─────────────

create or replace function apply_signal_update(p_account_id uuid, p_payload jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'system', true);
  update accounts set
    warmth_score     = case when p_payload ? 'warmth_score'     then (p_payload->>'warmth_score')::numeric          else warmth_score end,
    warmth_tier      = case when p_payload ? 'warmth_tier'      then (p_payload->>'warmth_tier')::warmth_tier       else warmth_tier end,
    score_trend      = case when p_payload ? 'score_trend'      then (p_payload->>'score_trend')::score_trend       else score_trend end,
    score_breakdown  = case when p_payload ? 'score_breakdown'  then p_payload->'score_breakdown'                   else score_breakdown end,
    top_signal_id    = case when p_payload ? 'top_signal_id'    then nullif(p_payload->>'top_signal_id','')::uuid   else top_signal_id end,
    signal_summary   = case when p_payload ? 'signal_summary'   then p_payload->>'signal_summary'                   else signal_summary end,
    why_now          = case when p_payload ? 'why_now'          then p_payload->>'why_now'                          else why_now end,
    outreach_angle   = case when p_payload ? 'outreach_angle'   then p_payload->>'outreach_angle'                   else outreach_angle end,
    company_brief    = case when p_payload ? 'company_brief'    then p_payload->'company_brief'                     else company_brief end,
    recommended_contact_id     = case when p_payload ? 'recommended_contact_id'     then nullif(p_payload->>'recommended_contact_id','')::uuid else recommended_contact_id end,
    recommended_contact_reason = case when p_payload ? 'recommended_contact_reason' then p_payload->>'recommended_contact_reason'              else recommended_contact_reason end,
    signals_last_3d  = case when p_payload ? 'signals_last_3d'  then (p_payload->>'signals_last_3d')::int           else signals_last_3d end,
    signals_last_14d = case when p_payload ? 'signals_last_14d' then (p_payload->>'signals_last_14d')::int          else signals_last_14d end,
    last_signal_at   = case when p_payload ? 'last_signal_at'   then nullif(p_payload->>'last_signal_at','')::timestamptz else last_signal_at end,
    last_scanned_at  = case when p_payload ? 'last_scanned_at'  then (p_payload->>'last_scanned_at')::timestamptz   else last_scanned_at end
  where id = p_account_id;
  -- Any key outside the SYSTEM column list is silently ignored by construction.
end $$;

-- ───────────── Layer 3: Arjun's write path (UI only) ─────────────

create or replace function create_account(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform set_config('app.actor', 'arjun', true);
  insert into accounts (company_name, domain, industry, hq_city, employee_band, stage,
                        search_aliases, exclude_terms, last_contact_date, arjun_notes,
                        relationship_read, next_step, next_step_due, do_not_contact_until)
  values (p->>'company_name', p->>'domain', p->>'industry', p->>'hq_city', p->>'employee_band',
          coalesce((p->>'stage')::account_stage, 'prospect'),
          coalesce(array(select jsonb_array_elements_text(p->'search_aliases')), '{}'),
          coalesce(array(select jsonb_array_elements_text(p->'exclude_terms')), '{}'),
          (p->>'last_contact_date')::date, p->>'arjun_notes', p->>'relationship_read',
          p->>'next_step', (p->>'next_step_due')::date, (p->>'do_not_contact_until')::date)
  returning id into v_id;
  return v_id;
end $$;

create or replace function update_manual_fields(p_account_id uuid, p_fields jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'arjun', true);
  update accounts set
    company_name         = case when p_fields ? 'company_name'  then p_fields->>'company_name'  else company_name end,
    domain               = case when p_fields ? 'domain'        then p_fields->>'domain'        else domain end,
    industry             = case when p_fields ? 'industry'      then p_fields->>'industry'      else industry end,
    hq_city              = case when p_fields ? 'hq_city'       then p_fields->>'hq_city'       else hq_city end,
    employee_band        = case when p_fields ? 'employee_band' then p_fields->>'employee_band' else employee_band end,
    stage                = case when p_fields ? 'stage'         then (p_fields->>'stage')::account_stage else stage end,
    search_aliases       = case when p_fields ? 'search_aliases' then array(select jsonb_array_elements_text(p_fields->'search_aliases')) else search_aliases end,
    exclude_terms        = case when p_fields ? 'exclude_terms'  then array(select jsonb_array_elements_text(p_fields->'exclude_terms'))  else exclude_terms end,
    last_contact_date    = case when p_fields ? 'last_contact_date'    then (p_fields->>'last_contact_date')::date    else last_contact_date end,
    arjun_notes          = case when p_fields ? 'arjun_notes'          then p_fields->>'arjun_notes'                  else arjun_notes end,
    relationship_read    = case when p_fields ? 'relationship_read'    then p_fields->>'relationship_read'            else relationship_read end,
    next_step            = case when p_fields ? 'next_step'            then p_fields->>'next_step'                    else next_step end,
    next_step_due        = case when p_fields ? 'next_step_due'        then (p_fields->>'next_step_due')::date        else next_step_due end,
    do_not_contact_until = case when p_fields ? 'do_not_contact_until' then (p_fields->>'do_not_contact_until')::date else do_not_contact_until end
  where id = p_account_id;
end $$;

create or replace function log_activity(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_at timestamptz := coalesce((p->>'occurred_at')::timestamptz, now());
  v_dir activity_direction := coalesce((p->>'direction')::activity_direction, 'outbound');
begin
  perform set_config('app.actor', 'arjun', true);
  insert into activities (account_id, contact_id, channel, direction, subject, body_sent,
                          outcome, note, occurred_at, created_via, draft_id)
  values ((p->>'account_id')::uuid, nullif(p->>'contact_id','')::uuid,
          (p->>'channel')::activity_channel, v_dir, p->>'subject', p->>'body_sent',
          nullif(p->>'outcome','')::activity_outcome, p->>'note', v_at,
          coalesce((p->>'created_via')::activity_via, 'manual'), nullif(p->>'draft_id','')::uuid)
  returning id into v_id;

  -- Arjun's own action: an outbound touch moves his last-contact date forward.
  if v_dir = 'outbound' then
    update accounts
       set last_contact_date = greatest(coalesce(last_contact_date, '1900-01-01'),
                                        (v_at at time zone 'Asia/Kolkata')::date)
     where id = (p->>'account_id')::uuid;
  end if;

  if p ? 'draft_id' and nullif(p->>'draft_id','') is not null then
    update outreach_drafts set status = 'used' where id = (p->>'draft_id')::uuid;
  end if;
  return v_id;
end $$;

create or replace function set_activity_outcome(p_activity_id uuid, p_outcome text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'arjun', true);
  update activities set outcome = nullif(p_outcome,'')::activity_outcome,
                        note = coalesce(p_note, note)
   where id = p_activity_id;
end $$;

create or replace function add_note(p_account_id uuid, p_body text, p_pinned boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform set_config('app.actor', 'arjun', true);
  insert into notes (account_id, body, pinned) values (p_account_id, p_body, p_pinned)
  returning id into v_id;
  return v_id;
end $$;

create or replace function set_note_pinned(p_note_id uuid, p_pinned boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'arjun', true);
  update notes set pinned = p_pinned where id = p_note_id;
end $$;

create or replace function upsert_contact(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  perform set_config('app.actor', 'arjun', true);
  if v_id is null then
    insert into contacts (account_id, full_name, title, email, linkedin_url, is_primary, notes)
    values ((p->>'account_id')::uuid, p->>'full_name', p->>'title', p->>'email',
            p->>'linkedin_url', coalesce((p->>'is_primary')::boolean, false), p->>'notes')
    returning id into v_id;
  else
    update contacts set
      full_name    = coalesce(p->>'full_name', full_name),
      title        = case when p ? 'title'        then p->>'title'        else title end,
      email        = case when p ? 'email'        then p->>'email'        else email end,
      linkedin_url = case when p ? 'linkedin_url' then p->>'linkedin_url' else linkedin_url end,
      is_primary   = case when p ? 'is_primary'   then (p->>'is_primary')::boolean else is_primary end,
      notes        = case when p ? 'notes'        then p->>'notes'        else notes end
    where id = v_id;
  end if;
  return v_id;
end $$;

-- Seed/reset helper (Arjun-equivalent action, used only by `npm run seed`).
create or replace function reset_demo_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.actor', 'arjun', true);
  perform set_config('app.allow_reset', 'on', true);
  delete from email_runs;
  delete from score_history;
  delete from scan_runs;
  delete from accounts;   -- cascades to every per-account table
end $$;

-- ───────────── Layer 4: proof ─────────────

create or replace function arjun_data_hash() returns text
language sql stable security definer set search_path = public as $$
  select md5(
    coalesce((select string_agg(jsonb_build_array(
        id, company_name, domain, industry, hq_city, employee_band, stage,
        search_aliases, exclude_terms, last_contact_date, arjun_notes,
        relationship_read, next_step, next_step_due, do_not_contact_until)::text, '§' order by id)
      from accounts), '')
    || '#C#' ||
    coalesce((select string_agg(jsonb_build_array(
        id, account_id, full_name, title, email, linkedin_url, is_primary, notes)::text, '§' order by id)
      from contacts), '')
    || '#A#' ||
    coalesce((select string_agg(jsonb_build_array(
        id, account_id, contact_id, channel, direction, subject, body_sent, outcome,
        note, occurred_at, created_via, draft_id)::text, '§' order by id)
      from activities), '')
    || '#N#' ||
    coalesce((select string_agg(jsonb_build_array(id, account_id, body, pinned, created_at)::text, '§' order by id)
      from notes), '')
  )
$$;

-- Attempts forbidden writes as the system actor and reports whether each was blocked.
create or replace function integrity_probe() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_acc uuid;
  r jsonb := '{}';
begin
  select id into v_acc from accounts order by company_name limit 1;
  if v_acc is null then return jsonb_build_object('error', 'no accounts'); end if;

  -- Everything below runs inside a block that is always rolled back, so even a
  -- hypothetical guard failure could never persist a change.
  begin
  perform set_config('app.actor', 'system', true);

  begin
    update accounts set arjun_notes = 'pipeline was here' where id = v_acc;
    r := r || jsonb_build_object('system_edit_arjun_notes', 'ALLOWED');
  exception when others then
    r := r || jsonb_build_object('system_edit_arjun_notes', 'BLOCKED', 'msg_notes', sqlerrm);
  end;

  begin
    update accounts set last_contact_date = current_date where id = v_acc;
    r := r || jsonb_build_object('system_edit_last_contact', 'ALLOWED');
  exception when others then
    r := r || jsonb_build_object('system_edit_last_contact', 'BLOCKED');
  end;

  begin
    insert into activities (account_id, channel, note) values (v_acc, 'email', 'fake');
    r := r || jsonb_build_object('system_insert_activity', 'ALLOWED');
  exception when others then
    r := r || jsonb_build_object('system_insert_activity', 'BLOCKED', 'msg_activity', sqlerrm);
  end;

  begin
    insert into notes (account_id, body) values (v_acc, 'fake');
    r := r || jsonb_build_object('system_insert_note', 'ALLOWED');
  exception when others then
    r := r || jsonb_build_object('system_insert_note', 'BLOCKED');
  end;

  begin
    update contacts set title = 'overwritten' where account_id = v_acc;
    r := r || jsonb_build_object('system_edit_contact', case when found then 'ALLOWED' else 'NO_ROWS' end);
  exception when others then
    r := r || jsonb_build_object('system_edit_contact', 'BLOCKED');
  end;

  -- A raw write with no actor at all (e.g. a stray service-role .update()) is also blocked.
  perform set_config('app.actor', '', true);
  begin
    update accounts set relationship_read = 'x' where id = v_acc;
    r := r || jsonb_build_object('no_actor_edit_relationship', 'ALLOWED');
  exception when others then
    r := r || jsonb_build_object('no_actor_edit_relationship', 'BLOCKED');
  end;

  raise exception 'PROBE_ROLLBACK';
  exception when raise_exception then
    if sqlerrm <> 'PROBE_ROLLBACK' then raise; end if;
  end;

  return r;
end $$;

-- ───────────── RLS + grants ─────────────
-- Browser (anon) may read everything for the dashboard / read-only demo mode.
-- All writes go through Next.js server routes (passcode-protected) using the
-- service role, and Arjun's data only via the RPCs above.

do $$
declare t text;
begin
  foreach t in array array['signal_types','product_profile','accounts','contacts','notes','articles',
                           'signals','outreach_drafts','activities','note_digests','scan_runs',
                           'score_history','email_runs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "read_all_%s" on %I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

revoke execute on function apply_signal_update(uuid, jsonb), create_account(jsonb),
  update_manual_fields(uuid, jsonb), log_activity(jsonb), set_activity_outcome(uuid, text, text),
  add_note(uuid, text, boolean), set_note_pinned(uuid, boolean), upsert_contact(jsonb),
  reset_demo_data(), integrity_probe()
  from public, anon, authenticated;
grant execute on function apply_signal_update(uuid, jsonb), create_account(jsonb),
  update_manual_fields(uuid, jsonb), log_activity(jsonb), set_activity_outcome(uuid, text, text),
  add_note(uuid, text, boolean), set_note_pinned(uuid, boolean), upsert_contact(jsonb),
  reset_demo_data(), integrity_probe()
  to service_role;
grant execute on function arjun_data_hash() to anon, authenticated, service_role;
