-- Admin Studio v2 (already applied to the live project as migration "admin_studio_v2").
-- Adds: audit log of admin actions, a "home" report (period vs previous period, live now, needs-attention, activity feed),
-- growth and retention, feature usage, user detail. Every function checks public.is_admin() first.
-- Safe to re-run.

-- ---------------------------------------------------------------- audit log
create table if not exists public.admin_audit (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  admin_email text,
  action      text not null,
  target      text,
  detail      text
);
alter table public.admin_audit enable row level security;
drop policy if exists "admin_audit_select_admin" on public.admin_audit;
create policy "admin_audit_select_admin" on public.admin_audit for select to authenticated using (public.is_admin());
create index if not exists admin_audit_ts_idx on public.admin_audit (ts desc);

create or replace function public._admin_log(p_action text, p_target text, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_audit (admin_email, action, target, detail)
  values (auth.jwt() ->> 'email', left(p_action, 40), left(p_target, 80), left(p_detail, 200));
$$;
revoke all on function public._admin_log(text, text, text) from public, anon, authenticated;

-- the three actions that change data now leave a trail
create or replace function public.admin_review_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select left(coalesce(title_name, title_key) || ' / ' || coalesce(headline, ''), 190) into t from public.title_reviews where id = p_id;
  delete from public.title_reviews where id = p_id;
  perform public._admin_log('review_delete', p_id::text, t);
end $$;

create or replace function public.admin_review_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_status not in ('visible', 'hidden') then raise exception 'bad status'; end if;
  perform set_config('app.mod', '1', true);
  update public.title_reviews set status = p_status where id = p_id
    returning left(coalesce(title_name, title_key) || ' / ' || coalesce(headline, ''), 190) into t;
  perform public._admin_log(case when p_status = 'hidden' then 'review_hide' else 'review_restore' end, p_id::text, t);
end $$;

create or replace function public.admin_purge_events(p_days int) returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_days is null or p_days < 7 then raise exception 'keep at least 7 days'; end if;
  delete from events where ts < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  perform public._admin_log('purge_events', 'older than ' || p_days || ' days', n || ' events deleted');
  return n;
end $$;

create or replace function public.admin_audit_log(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (select ts, admin_email, action, target, detail from public.admin_audit order by ts desc limit greatest(1, least(coalesce(p_limit, 100), 500))) x), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- home: this period vs the one before, live, attention, feed
create or replace function public.admin_home(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  since timestamptz := now() - make_interval(days => d);
  before timestamptz := now() - make_interval(days => d * 2);
  cur jsonb; prv jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select jsonb_build_object('visitors', count(distinct sid), 'visits', count(*) filter (where type = 'visit'), 'title_opens', count(*) filter (where type = 'title_open'),
           'searches', count(*) filter (where type = 'search'), 'trailers', count(*) filter (where type = 'trailer_play'), 'ott', count(*) filter (where type = 'ott_click'),
           'saves', count(*) filter (where type = 'watchlist_add'), 'errors', count(*) filter (where type = 'js_error'))
    into cur from events where ts >= since;
  select jsonb_build_object('visitors', count(distinct sid), 'visits', count(*) filter (where type = 'visit'), 'title_opens', count(*) filter (where type = 'title_open'),
           'searches', count(*) filter (where type = 'search'), 'trailers', count(*) filter (where type = 'trailer_play'), 'ott', count(*) filter (where type = 'ott_click'),
           'saves', count(*) filter (where type = 'watchlist_add'), 'errors', count(*) filter (where type = 'js_error'))
    into prv from events where ts >= before and ts < since;
  cur := cur || jsonb_build_object(
    'accounts', (select count(*) from auth.users where created_at >= since),
    'verdicts', (select count(*) from title_votes where created_at >= since),
    'reviews',  (select count(*) from title_reviews where created_at >= since));
  prv := prv || jsonb_build_object(
    'accounts', (select count(*) from auth.users where created_at >= before and created_at < since),
    'verdicts', (select count(*) from title_votes where created_at >= before and created_at < since),
    'reviews',  (select count(*) from title_reviews where created_at >= before and created_at < since));
  return jsonb_build_object(
    'days', d, 'cur', cur, 'prev', prv,
    'live_30m', (select count(distinct sid) from events where ts >= now() - interval '30 minutes'),
    'live_24h', (select count(distinct sid) from events where ts >= now() - interval '24 hours'),
    'newest_event', (select max(ts) from events),
    'attention', jsonb_build_object(
      'reported_reviews', (select count(distinct review_id) from review_reports r join title_reviews t on t.id = r.review_id where t.status <> 'hidden'),
      'errors_24h', (select count(*) from events where ts >= now() - interval '24 hours' and type = 'js_error'),
      'poster_fail_7d', (select count(distinct props ->> 'id') from events where ts >= now() - interval '7 days' and type = 'poster_fail'),
      'trailer_fail_7d', (select count(distinct props ->> 'id') from events where ts >= now() - interval '7 days' and type = 'trailer_fail'),
      'zero_search_7d', (select count(distinct lower(props ->> 'q')) from events where ts >= now() - interval '7 days' and type = 'search' and props ->> 'n' = '0'),
      'unverified_users', (select count(*) from auth.users where email_confirmed_at is null)),
    'feed', coalesce((select jsonb_agg(x) from (
      select ts, type, left(coalesce(props ->> 't', props ->> 'q', props ->> 'svc', props ->> 'm', props ->> 'v', props ->> 'p', props ->> 'g', props ->> 'id', ''), 80) what,
             coalesce(country, '??') cc, device
      from events where type <> 'view' order by ts desc limit 40) x), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- growth and retention
create or replace function public.admin_growth(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  since timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'dau', (select count(distinct sid) from events where ts >= now() - interval '1 day'),
    'wau', (select count(distinct sid) from events where ts >= now() - interval '7 days'),
    'mau', (select count(distinct sid) from events where ts >= now() - interval '30 days'),
    'daily', coalesce((
      with firsts as (select sid, min(ts) f from events group by sid),
           act as (select date_trunc('day', ts) dd, count(distinct sid) v from events where ts >= since group by 1),
           nw as (select date_trunc('day', f) dd, count(*) n from firsts where f >= since group by 1),
           ac as (select date_trunc('day', created_at) dd, count(*) n from auth.users where created_at >= since group by 1)
      select jsonb_agg(jsonb_build_object('d', to_char(g.dd, 'YYYY-MM-DD'), 'visitors', coalesce(act.v, 0), 'new', coalesce(nw.n, 0), 'accounts', coalesce(ac.n, 0)) order by g.dd)
      from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') g(dd)
      left join act on act.dd = g.dd left join nw on nw.dd = g.dd left join ac on ac.dd = g.dd), '[]'::jsonb),
    'accounts_total', (select count(*) from auth.users),
    'cohort', (
      with firsts as (select sid, min(ts) f from events group by sid),
           c as (select sid, f from firsts where f >= since and f < date_trunc('day', now()))
      select jsonb_build_object('size', count(*),
        'returned', count(*) filter (where exists (select 1 from events e where e.sid = c.sid and e.ts >= date_trunc('day', c.f) + interval '1 day')),
        'returned_7d', count(*) filter (where exists (select 1 from events e where e.sid = c.sid and e.ts >= date_trunc('day', c.f) + interval '1 day' and e.ts < date_trunc('day', c.f) + interval '8 days')))
      from c),
    'days_active', coalesce((select jsonb_agg(x) from (
      select case when n = 1 then '1 day' when n = 2 then '2 days' when n <= 5 then '3 to 5 days' else '6+ days' end k, count(*) n
      from (select sid, count(distinct date_trunc('day', ts)) n from events where ts >= since group by sid) s group by 1 order by min(n)) x), '[]'::jsonb),
    'by_hour', coalesce((select jsonb_agg(jsonb_build_object('h', h, 'n', coalesce(c.n, 0)) order by h)
      from generate_series(0, 23) h left join (select extract(hour from ts at time zone 'Asia/Kolkata')::int hh, count(distinct sid) n from events where ts >= since group by 1) c on c.hh = h), '[]'::jsonb),
    'by_weekday', coalesce((select jsonb_agg(jsonb_build_object('w', w, 'n', coalesce(c.n, 0)) order by w)
      from generate_series(0, 6) w left join (select extract(dow from ts at time zone 'Asia/Kolkata')::int ww, count(distinct sid) n from events where ts >= since group by 1) c on c.ww = w), '[]'::jsonb),
    'providers', coalesce((select jsonb_agg(x) from (select coalesce(props ->> 'p', '?') k, count(*) n from events where ts >= since and type = 'signup' group by 1 order by 2 desc) x), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- feature usage, games, community
create or replace function public.admin_features(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d int := greatest(1, least(coalesce(p_days, 30), 365));
  since timestamptz := now() - make_interval(days => d);
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'usage', coalesce((select jsonb_agg(x) from (select type k, count(*) n, count(distinct sid) v from events
        where ts >= since and type in ('title_open','search','mood','trailer_play','watchlist_add','vibe_vote','actor_open','ott_click','region_change','game_room','game_start','daily_done')
        group by 1 order by 2 desc) x), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(x) from (select coalesce(props ->> 'g', '?') k, count(*) n, round(avg((props ->> 'n')::numeric), 1) players from events where ts >= since and type = 'game_start' group by 1 order by 2 desc) x), '[]'::jsonb),
    'rooms', (select count(*) from events where ts >= since and type = 'game_room'),
    'daily_plays', (select count(*) from events where ts >= since and type = 'daily_done'),
    'daily_levels', coalesce((select jsonb_agg(x) from (select coalesce(props ->> 'l', '?') k, count(*) n, round(avg((props ->> 's')::numeric)) avg_score from events where ts >= since and type = 'daily_done' group by 1 order by 2 desc) x), '[]'::jsonb),
    'leaderboard', jsonb_build_object('rows', (select count(*) from daily_scores), 'players', (select count(distinct user_id) from daily_scores),
        'recent', coalesce((select jsonb_agg(x) from (select day, left(name, 30) name, score, solved, level from daily_scores order by created_at desc limit 8) x), '[]'::jsonb)),
    'verdict_tiers', coalesce((select jsonb_agg(x) from (select tier k, count(*) n from title_votes where created_at >= since group by 1 order by 1) x), '[]'::jsonb),
    'top_voted', coalesce((select jsonb_agg(x) from (select v.title_key k, coalesce((select max(r.title_name) from title_reviews r where r.title_key = v.title_key), v.title_key) t, count(*) n, round(avg(v.tier), 1) avg_tier
        from title_votes v where v.created_at >= since group by v.title_key order by 3 desc limit 10) x), '[]'::jsonb),
    'community_daily', coalesce((
      with g as (select generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') dd),
           v as (select date_trunc('day', created_at) dd, count(*) n from title_votes where created_at >= since group by 1),
           r as (select date_trunc('day', created_at) dd, count(*) n from title_reviews where created_at >= since group by 1)
      select jsonb_agg(jsonb_build_object('d', to_char(g.dd, 'YYYY-MM-DD'), 'verdicts', coalesce(v.n, 0), 'reviews', coalesce(r.n, 0)) order by g.dd)
      from g left join v on v.dd = g.dd left join r on r.dd = g.dd), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- one user
create or replace function public.admin_user_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare u record;
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into u from auth.users where id = p_id;
  if not found then raise exception 'no such user'; end if;
  return jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'verified', u.email_confirmed_at is not null,
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'name', coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    'verdicts', (select count(*) from title_votes where user_id = p_id),
    'reviews', (select count(*) from title_reviews where user_id = p_id),
    'reports_on_their_reviews', (select count(*) from review_reports rr join title_reviews t on t.id = rr.review_id where t.user_id = p_id),
    'reports_made', (select count(*) from review_reports where reporter = p_id),
    'daily_plays', (select count(*) from daily_scores where user_id = p_id),
    'daily_best', (select max(score) from daily_scores where user_id = p_id),
    'recent_reviews', coalesce((select jsonb_agg(x) from (select id, title_name, left(headline, 120) headline, status, created_at from title_reviews where user_id = p_id order by created_at desc limit 5) x), '[]'::jsonb)
  );
end $$;

revoke all on function public.admin_audit_log(int), public.admin_home(int), public.admin_growth(int), public.admin_features(int), public.admin_user_detail(uuid),
  public.admin_review_delete(uuid), public.admin_review_status(uuid, text), public.admin_purge_events(int) from public, anon;
grant execute on function public.admin_audit_log(int), public.admin_home(int), public.admin_growth(int), public.admin_features(int), public.admin_user_detail(uuid),
  public.admin_review_delete(uuid), public.admin_review_status(uuid, text), public.admin_purge_events(int) to authenticated;
