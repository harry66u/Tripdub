-- Per-question answer stats for Daily Trivia ("41% of players got this right"), and one-time
-- claims so a game step (a spin, an answer) can't be replayed with a different choice.

create table public.question_stats (
  question_id text primary key,
  total integer not null default 0,
  correct integer not null default 0
);
alter table public.question_stats enable row level security;

create table private.claims (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
create index claims_created_at on private.claims (created_at);

create or replace function private.check_server_secret(p_secret text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_hash text;
begin
  select secret_hash into v_hash from private.server_config where id;
  if v_hash is null
     or p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from v_hash then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Record one answer; returns the stats from before it (used for the rarity bonus).
create or replace function public.record_trivia_answer(p_secret text, p_question text, p_correct boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_total integer; v_correct integer;
begin
  perform private.check_server_secret(p_secret);
  if p_question is null or char_length(p_question) > 32 or p_correct is null then
    raise exception 'invalid answer' using errcode = '22023';
  end if;
  insert into public.question_stats as s (question_id, total, correct)
  values (p_question, 1, case when p_correct then 1 else 0 end)
  on conflict (question_id) do update
    set total = s.total + 1, correct = s.correct + case when p_correct then 1 else 0 end
  returning s.total - 1, s.correct - case when p_correct then 1 else 0 end into v_total, v_correct;
  return jsonb_build_object('total', v_total, 'correct', v_correct);
end;
$$;

-- Claim `p_key` for `p_value`. Returns the value stored for the key (yours if you were first)
-- and whether this call created it.
create or replace function public.claim_once(p_secret text, p_key text, p_value text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_value text; v_rows integer;
begin
  perform private.check_server_secret(p_secret);
  if p_key is null or char_length(p_key) > 128 or p_value is null or char_length(p_value) > 512 then
    raise exception 'invalid claim' using errcode = '22023';
  end if;
  insert into private.claims (key, value) values (p_key, p_value) on conflict (key) do nothing;
  get diagnostics v_rows = row_count;
  select c.value into v_value from private.claims c where c.key = p_key;
  if random() < 0.01 then
    delete from private.claims where created_at < now() - interval '3 days';
  end if;
  return jsonb_build_object('value', v_value, 'fresh', v_rows > 0);
end;
$$;

revoke all on function private.check_server_secret(text) from public, anon, authenticated;
revoke all on function public.record_trivia_answer(text, text, boolean) from public;
revoke all on function public.claim_once(text, text, text) from public;
grant execute on function public.record_trivia_answer(text, text, boolean) to anon, authenticated;
grant execute on function public.claim_once(text, text, text) to anon, authenticated;
