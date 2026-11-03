-- Deep Cut joins the daily games.
alter table public.daily_results drop constraint if exists daily_results_game_check;
alter table public.daily_results
  add constraint daily_results_game_check check (game in ('starting-five', 'trivia', 'shot-chart', 'deep-cut'));
