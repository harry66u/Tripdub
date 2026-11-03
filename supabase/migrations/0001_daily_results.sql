-- Daily results for every game. Rows are written only through record_daily_result(),
-- which the Next.js server calls with a shared secret after re-validating the run.

create extension if not exists pgcrypto with schema extensions;

create table public.daily_results (
  id bigint generated always as identity primary key,
  game text not null check (game in ('starting-five', 'trivia', 'shot-chart')),
  puzzle_date date not null,
  device_id text not null check (char_length(device_id) between 8 and 64),
  user_id uuid references auth.users (id) on delete set null,
  score double precision not null,
  tiebreak double precision not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game, puzzle_date, device_id)
);

create unique index daily_results_user_day on public.daily_results (game, puzzle_date, user_id) where user_id is not null;
create index daily_results_rank on public.daily_results (game, puzzle_date, score desc, tiebreak desc);
create index daily_results_user on public.daily_results (user_id) where user_id is not null;

alter table public.daily_results enable row level security;

create policy "Players can read their own results"
  on public.daily_results for select to authenticated
  using (user_id = (select auth.uid()));

-- Server secret lives outside the API-exposed schemas.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.server_config (
  id boolean primary key default true check (id),
  secret_hash text not null
);

create or replace function public.record_daily_result(
  p_secret text,
  p_game text,
  p_date date,
  p_device text,
  p_score double precision,
  p_tiebreak double precision,
  p_detail jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_score double precision;
  v_tiebreak double precision;
  v_total bigint;
  v_beaten double precision;
begin
  select secret_hash into v_hash from private.server_config where id;
  if v_hash is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> v_hash then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.daily_results (game, puzzle_date, device_id, score, tiebreak, detail)
  values (p_game, p_date, p_device, p_score, p_tiebreak, coalesce(p_detail, '{}'::jsonb))
  on conflict (game, puzzle_date, device_id) do nothing;

  -- The first finish per device counts; rank that stored score.
  select r.score, r.tiebreak into v_score, v_tiebreak
  from public.daily_results r
  where r.game = p_game and r.puzzle_date = p_date and r.device_id = p_device;

  select count(*),
         coalesce(sum(case
           when r.score < v_score or (r.score = v_score and r.tiebreak < v_tiebreak) then 1.0
           when r.score = v_score and r.tiebreak = v_tiebreak then 0.5
           else 0 end), 0)
    into v_total, v_beaten
  from public.daily_results r
  where r.game = p_game and r.puzzle_date = p_date;

  -- Share of *other* players beaten (ties count half); the row ties itself once (0.5).
  return jsonb_build_object(
    'percentile', case when v_total <= 1 then 1.0 else (v_beaten - 0.5) / (v_total - 1) end,
    'total', v_total
  );
end;
$$;

revoke all on function public.record_daily_result(text, text, date, text, double precision, double precision, jsonb) from public;
grant execute on function public.record_daily_result(text, text, date, text, double precision, double precision, jsonb) to anon, authenticated;
