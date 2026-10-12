-- Gemini assigns a canonical key per real-world event; clustering groups on it.
alter table signals add column if not exists event_key text;
create index if not exists signals_event_key_idx on signals(account_id, event_key);
