-- WatchVibe admin analytics. Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- Privacy: events hold NO emails, names or IP addresses. `sid` is a random anonymous id kept in the visitor's browser.

-- ---------------------------------------------------------------- admins
create table if not exists public.admins (
  email    text primary key,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
insert into public.admins (email) values ('dasdebarshi1234@gmail.com') on conflict do nothing;

-- True only for a verified JWT whose email is listed in public.admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email'))
     and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false);
$$;

drop policy if exists "admins_select_admin" on public.admins;
create policy "admins_select_admin" on public.admins for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- events
create table if not exists public.events (
  id      bigint generated always as identity primary key,
  ts      timestamptz not null default now(),
  sid     text not null check (char_length(sid) between 8 and 64),
  type    text not null check (type in ('visit','view','title_open','search','ott_click','trailer_play','trailer_fail','poster_fail','avail_none','watchlist_add','vibe_vote','mood','actor_open','signup','login','js_error','region_change')),
  props   jsonb not null default '{}'::jsonb check (octet_length(props::text) <= 1500),
  country text check (country is null or char_length(country) = 2),
  device  text check (device is null or device in ('mobile','tablet','desktop')),
  browser text check (browser is null or char_length(browser) <= 20),
  ref     text check (ref is null or char_length(ref) <= 80),
  path    text check (path is null or char_length(path) <= 40)
);
create index if not exists events_ts_idx on public.events (ts desc);
create index if not exists events_type_ts_idx on public.events (type, ts desc);
create index if not exists events_sid_idx on public.events (sid);

alter table public.events enable row level security;
drop policy if exists "events_insert_any"   on public.events;
drop policy if exists "events_select_admin" on public.events;
create policy "events_insert_any"   on public.events for insert to anon, authenticated with check (true);
create policy "events_select_admin" on public.events for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- reports (admin only, enforced here)
create or replace function public.admin_overview(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'since', since,
    'visitors',     (select count(distinct sid) from events where ts >= since),
    'new_visitors', (select count(*) from (select sid from events group by sid having min(ts) >= since) n),
    'visits',       (select count(*) from events where ts >= since and type = 'visit'),
    'pageviews',    (select count(*) from events where ts >= since and type = 'view'),
    'title_opens',  (select count(*) from events where ts >= since and type = 'title_open'),
    'searches',     (select count(*) from events where ts >= since and type = 'search'),
    'ott_clicks',   (select count(*) from events where ts >= since and type = 'ott_click'),
    'signups',      (select count(*) from events where ts >= since and type = 'signup'),
    'logins',       (select count(*) from events where ts >= since and type = 'login'),
    'errors',       (select count(*) from events where ts >= since and type = 'js_error'),
    'last_event',   (select max(ts) from events),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('d', to_char(g.d, 'YYYY-MM-DD'), 'visitors', coalesce(c.v, 0), 'visits', coalesce(c.n, 0)) order by g.d)
      from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') g(d)
      left join (select date_trunc('day', ts) d, count(distinct sid) v, count(*) filter (where type = 'visit') n from events where ts >= since group by 1) c on c.d = g.d
    ), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(x) from (select coalesce(country, '??') k, count(distinct sid) n from events where ts >= since group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'devices',   coalesce((select jsonb_agg(x) from (select coalesce(device, '?') k, count(distinct sid) n from events where ts >= since group by 1 order by 2 desc) x), '[]'::jsonb),
    'browsers',  coalesce((select jsonb_agg(x) from (select coalesce(browser, '?') k, count(distinct sid) n from events where ts >= since group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(x) from (select coalesce(ref, 'direct') k, count(*) n from events where ts >= since and type = 'visit' group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
    'funnel', (select jsonb_build_object(
        'visit',      count(distinct sid) filter (where type = 'visit'),
        'title_open', count(distinct sid) filter (where type = 'title_open'),
        'trailer',    count(distinct sid) filter (where type = 'trailer_play'),
        'ott',        count(distinct sid) filter (where type = 'ott_click'),
        'account',    count(distinct sid) filter (where type in ('signup', 'login'))) from events where ts >= since),
    'top_searches', coalesce((select jsonb_agg(x) from (select lower(left(props ->> 'q', 60)) q, count(*) n, count(*) filter (where props ->> 'n' = '0') zero from events where ts >= since and type = 'search' and props ? 'q' group by 1 order by 2 desc limit 15) x), '[]'::jsonb),
    'zero_searches', coalesce((select jsonb_agg(x) from (select lower(left(props ->> 'q', 60)) q, count(*) n from events where ts >= since and type = 'search' and props ->> 'n' = '0' group by 1 order by 2 desc limit 15) x), '[]'::jsonb),
    'top_titles', coalesce((select jsonb_agg(x) from (select left(props ->> 'id', 80) id, max(left(props ->> 't', 100)) t, count(*) n, count(distinct sid) v from events where ts >= since and type = 'title_open' and props ? 'id' group by 1 order by 3 desc limit 12) x), '[]'::jsonb),
    'moods', coalesce((select jsonb_agg(x) from (select lower(left(props ->> 'q', 80)) q, count(*) n from events where ts >= since and type = 'mood' and props ? 'q' group by 1 order by 2 desc limit 12) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_users() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total',    (select count(*) from auth.users),
    'verified', (select count(*) from auth.users where email_confirmed_at is not null),
    'new_7d',   (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_30d',  (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'by_provider', coalesce((select jsonb_agg(x) from (select coalesce(raw_app_meta_data ->> 'provider', 'email') k, count(*) n from auth.users group by 1 order by 2 desc) x), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(x) from (
      select u.id, u.email, u.created_at, u.last_sign_in_at,
             (u.email_confirmed_at is not null) as verified,
             coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
             coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name') as name,
             u.raw_user_meta_data ->> 'character' as icon,
             case when jsonb_typeof(w.watchlist_data -> 'watchlist') = 'array' then jsonb_array_length(w.watchlist_data -> 'watchlist') else 0 end as watchlist,
             case when jsonb_typeof(w.watchlist_data -> 'watched_history') = 'array' then jsonb_array_length(w.watchlist_data -> 'watched_history') else 0 end as watched
      from auth.users u left join public.user_watchlists w on w.user_id = u.id
      order by u.created_at desc limit 1000) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_content(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'top_opened', coalesce((select jsonb_agg(x) from (select left(props ->> 'id', 80) id, max(left(props ->> 't', 100)) t, count(*) n from events where ts >= since and type = 'title_open' and props ? 'id' group by 1 order by 3 desc limit 15) x), '[]'::jsonb),
    'top_saved',  coalesce((select jsonb_agg(x) from (select left(props ->> 'id', 80) id, max(left(props ->> 't', 100)) t, count(*) n from events where ts >= since and type = 'watchlist_add' and props ? 'id' group by 1 order by 3 desc limit 15) x), '[]'::jsonb),
    'poster_fail', coalesce((select jsonb_agg(x) from (select left(props ->> 'id', 80) id, max(left(props ->> 't', 100)) t, count(*) n from events where ts >= since and type = 'poster_fail' group by 1 order by 3 desc limit 15) x), '[]'::jsonb),
    'trailer_fail', coalesce((select jsonb_agg(x) from (select left(props ->> 'id', 80) id, max(left(props ->> 't', 100)) t, count(*) n from events where ts >= since and type = 'trailer_fail' group by 1 order by 3 desc limit 15) x), '[]'::jsonb),
    'avail_none', coalesce((select jsonb_agg(x) from (select left(props ->> 'id', 80) id, max(left(props ->> 't', 100)) t, coalesce(country, '??') cc, count(*) n from events where ts >= since and type = 'avail_none' group by 1, 3 order by 4 desc limit 20) x), '[]'::jsonb),
    'trailers', (select jsonb_build_object('played', count(*) filter (where type = 'trailer_play'), 'failed', count(*) filter (where type = 'trailer_fail')) from events where ts >= since),
    'vibes', coalesce((select jsonb_agg(x) from (select left(props ->> 'v', 30) k, count(*) n from events where ts >= since and type = 'vibe_vote' group by 1 order by 2 desc) x), '[]'::jsonb),
    'actors', coalesce((select jsonb_agg(x) from (select left(props ->> 'n', 60) k, count(*) n from events where ts >= since and type = 'actor_open' group by 1 order by 2 desc limit 10) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_streaming(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total', (select count(*) from events where ts >= since and type = 'ott_click'),
    'by_service', coalesce((select jsonb_agg(x) from (select lower(left(props ->> 'svc', 40)) k, count(*) n from events where ts >= since and type = 'ott_click' group by 1 order by 2 desc limit 15) x), '[]'::jsonb),
    'by_region',  coalesce((select jsonb_agg(x) from (select coalesce(country, '??') k, count(*) n from events where ts >= since and type = 'ott_click' group by 1 order by 2 desc limit 12) x), '[]'::jsonb),
    'matrix',     coalesce((select jsonb_agg(x) from (select lower(left(props ->> 'svc', 40)) svc, coalesce(country, '??') cc, count(*) n from events where ts >= since and type = 'ott_click' group by 1, 2 order by 3 desc limit 25) x), '[]'::jsonb),
    'top_titles', coalesce((select jsonb_agg(x) from (select left(props ->> 'id', 80) id, max(left(props ->> 't', 100)) t, count(*) n from events where ts >= since and type = 'ott_click' and props ? 'id' group by 1 order by 3 desc limit 12) x), '[]'::jsonb),
    'unavailable_by_region', coalesce((select jsonb_agg(x) from (select coalesce(country, '??') k, count(*) n from events where ts >= since and type = 'avail_none' group by 1 order by 2 desc limit 10) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_system() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'events_total',  (select count(*) from events),
    'events_24h',    (select count(*) from events where ts >= now() - interval '24 hours'),
    'oldest_event',  (select min(ts) from events),
    'newest_event',  (select max(ts) from events),
    'errors_24h',    (select count(*) from events where ts >= now() - interval '24 hours' and type = 'js_error'),
    'recent_errors', coalesce((select jsonb_agg(x) from (select ts, left(props ->> 'm', 160) m, left(props ->> 'w', 60) w, coalesce(country, '??') cc, device from events where type = 'js_error' order by ts desc limit 10) x), '[]'::jsonb),
    'events_table_bytes', pg_total_relation_size('public.events'),
    'database_bytes', pg_database_size(current_database()),
    'admins', coalesce((select jsonb_agg(email) from admins), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_purge_events(p_days int) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_days is null or p_days < 7 then raise exception 'keep at least 7 days'; end if;
  delete from events where ts < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;

-- Only signed-in users may call the report functions (the functions then require the admin email).
revoke all on function public.admin_overview(int), public.admin_users(), public.admin_content(int), public.admin_streaming(int), public.admin_system(), public.admin_purge_events(int) from public, anon;
grant execute on function public.admin_overview(int), public.admin_users(), public.admin_content(int), public.admin_streaming(int), public.admin_system(), public.admin_purge_events(int) to authenticated;
