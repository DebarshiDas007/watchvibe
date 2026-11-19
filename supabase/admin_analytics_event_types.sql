-- Migration: allow the game and daily-challenge analytics events.
-- The app sends game_room, game_start, game_conn and daily_done, which the original
-- events.type check did not allow, so those inserts were rejected.
-- Safe to run more than once. It rebuilds the type check with the full list.

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass and contype = 'c'
      and conkey = array[(select attnum from pg_attribute
                          where attrelid = 'public.events'::regclass and attname = 'type')]::int2[]
  loop
    execute format('alter table public.events drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.events add constraint events_type_check check (type in (
  'visit','view','title_open','search','ott_click','trailer_play','trailer_fail','poster_fail',
  'avail_none','watchlist_add','vibe_vote','mood','actor_open','signup','login','js_error',
  'region_change','game_room','game_start','game_conn','daily_done'
));
