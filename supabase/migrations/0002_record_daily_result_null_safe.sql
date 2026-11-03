-- Fix: a NULL p_secret made the old check evaluate to NULL (not true), skipping the raise.
-- Compare null-safely, and bound the score and payload size.
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
  if v_hash is null
     or p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from v_hash then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_score is null or p_score < -1000 or p_score > 1000
     or p_tiebreak is null or abs(p_tiebreak) > 1000
     or octet_length(coalesce(p_detail, '{}'::jsonb)::text) > 4000 then
    raise exception 'invalid result' using errcode = '22023';
  end if;

  insert into public.daily_results (game, puzzle_date, device_id, score, tiebreak, detail)
  values (p_game, p_date, p_device, p_score, p_tiebreak, coalesce(p_detail, '{}'::jsonb))
  on conflict (game, puzzle_date, device_id) do nothing;

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

  return jsonb_build_object(
    'percentile', case when v_total <= 1 then 1.0 else (v_beaten - 0.5) / (v_total - 1) end,
    'total', v_total
  );
end;
$$;

revoke all on function public.record_daily_result(text, text, date, text, double precision, double precision, jsonb) from public;
grant execute on function public.record_daily_result(text, text, date, text, double precision, double precision, jsonb) to anon, authenticated;
