-- Security checks for record_daily_result. Run in the Supabase SQL editor; it leaves no rows behind.
do $$
declare rejected_null boolean := false; rejected_wrong boolean := false;
begin
  begin
    perform public.record_daily_result(null, 'starting-five', '2000-01-02', 'sectest-null', 50, 0, '{}');
  exception when insufficient_privilege then rejected_null := true;
  end;
  begin
    perform public.record_daily_result('wrong-secret', 'starting-five', '2000-01-02', 'sectest-wrong', 50, 0, '{}');
  exception when insufficient_privilege then rejected_wrong := true;
  end;
  delete from public.daily_results where puzzle_date = '2000-01-02';
  if not rejected_null then raise exception 'NULL secret was accepted'; end if;
  if not rejected_wrong then raise exception 'wrong secret was accepted'; end if;
end $$;
select 'secret checks pass' as status;
