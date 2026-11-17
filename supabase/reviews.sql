-- WatchVibe verdicts (6-tier ladder + feelings), reviews, "felt this too" and reports.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to re-run. Requires admin_analytics.sql (is_admin()).
-- tier: 1 Absolute Cinema, 2 Standing Ovation, 3 Paisa Vasool, 4 Worth a Watch, 5 Timepass, 6 Left at Interval

-- ---------------------------------------------------------------- votes (one per person per title)
create table if not exists public.title_votes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  title_key  text not null check (char_length(title_key) between 3 and 60),
  tier       smallint not null check (tier between 1 and 6),
  feelings   text[] not null default '{}' check (cardinality(feelings) <= 1 and feelings <@ array['moved_to_tears','laughed_out_loud','mind_blown','hidden_gem','good_timepass']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, title_key)
);
create index if not exists title_votes_key_idx on public.title_votes (title_key);
alter table public.title_votes enable row level security;
drop policy if exists "votes_select_own" on public.title_votes;
drop policy if exists "votes_insert_own" on public.title_votes;
drop policy if exists "votes_update_own" on public.title_votes;
drop policy if exists "votes_delete_own" on public.title_votes;
create policy "votes_select_own" on public.title_votes for select to authenticated using (auth.uid() = user_id);
create policy "votes_insert_own" on public.title_votes for insert to authenticated with check (auth.uid() = user_id);
create policy "votes_update_own" on public.title_votes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "votes_delete_own" on public.title_votes for delete to authenticated using (auth.uid() = user_id);

create or replace function public.touch_vote() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists title_votes_touch on public.title_votes;
create trigger title_votes_touch before update on public.title_votes for each row execute function public.touch_vote();

-- Public totals for a title, plus the caller's own vote. Nobody can read other people's individual votes.
create or replace function public.title_vote_summary(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'tiers', jsonb_build_array(
      count(*) filter (where tier = 1), count(*) filter (where tier = 2), count(*) filter (where tier = 3),
      count(*) filter (where tier = 4), count(*) filter (where tier = 5), count(*) filter (where tier = 6)),
    'feelings', jsonb_build_object(
      'moved_to_tears',   count(*) filter (where 'moved_to_tears' = any(feelings)),
      'laughed_out_loud', count(*) filter (where 'laughed_out_loud' = any(feelings)),
      'mind_blown',       count(*) filter (where 'mind_blown' = any(feelings)),
      'hidden_gem',       count(*) filter (where 'hidden_gem' = any(feelings)),
      'good_timepass',    count(*) filter (where 'good_timepass' = any(feelings))),
    'mine', (select jsonb_build_object('tier', v.tier, 'feelings', v.feelings) from public.title_votes v where v.title_key = p_key and v.user_id = auth.uid())
  ) from public.title_votes where title_key = p_key;
$$;

-- ---------------------------------------------------------------- reviews
create table if not exists public.title_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title_key   text not null check (char_length(title_key) between 3 and 60),
  title_name  text not null check (char_length(title_name) between 1 and 120),
  author_name text not null check (char_length(author_name) between 1 and 40),
  author_icon text check (author_icon is null or char_length(author_icon) <= 30),
  headline    text not null check (char_length(btrim(headline)) between 2 and 140),
  body        text not null default '' check (char_length(body) <= 4000),
  spoiler     boolean not null default false,
  status      text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, title_key)
);
create index if not exists title_reviews_key_idx on public.title_reviews (title_key, status);
alter table public.title_reviews enable row level security;
drop policy if exists "reviews_select_own" on public.title_reviews;
drop policy if exists "reviews_insert_own" on public.title_reviews;
drop policy if exists "reviews_update_own" on public.title_reviews;
drop policy if exists "reviews_delete_own" on public.title_reviews;
-- other people's reviews are read through title_reviews_list() so author ids stay private
create policy "reviews_select_own" on public.title_reviews for select to authenticated using (auth.uid() = user_id);
create policy "reviews_insert_own" on public.title_reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "reviews_update_own" on public.title_reviews for update to authenticated using (auth.uid() = user_id and status = 'visible') with check (auth.uid() = user_id);
create policy "reviews_delete_own" on public.title_reviews for delete to authenticated using (auth.uid() = user_id);

-- Guard rails: 500-word cap, no links (spam), 10 new reviews per hour, authors cannot change owner or moderation status.
create or replace function public.review_guard() returns trigger language plpgsql as $$
declare words int;
begin
  new.headline := btrim(new.headline);
  new.body := btrim(coalesce(new.body, ''));
  if new.body <> '' then
    words := array_length(regexp_split_to_array(new.body, '\s+'), 1);
    if words > 500 then raise exception 'Reviews can be at most 500 words'; end if;
  end if;
  if (new.headline || ' ' || new.body) ~* '(https?://|www\.|\.com/|\.in/|\.net/)' then raise exception 'Links are not allowed in reviews'; end if;
  if tg_op = 'INSERT' then
    new.status := 'visible';
    if (select count(*) from public.title_reviews where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'You are posting too fast. Try again later';
    end if;
  else
    new.user_id := old.user_id;
    new.title_key := old.title_key;
    if coalesce(current_setting('app.mod', true), '') <> '1' then new.status := old.status; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists title_reviews_guard on public.title_reviews;
create trigger title_reviews_guard before insert or update on public.title_reviews for each row execute function public.review_guard();

-- ---------------------------------------------------------------- "felt this too"
create table if not exists public.review_reactions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  review_id  uuid not null references public.title_reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);
alter table public.review_reactions enable row level security;
drop policy if exists "reactions_select_own" on public.review_reactions;
drop policy if exists "reactions_insert_own" on public.review_reactions;
drop policy if exists "reactions_delete_own" on public.review_reactions;
create policy "reactions_select_own" on public.review_reactions for select to authenticated using (auth.uid() = user_id);
-- you cannot react to your own review (the subquery only sees your own reviews)
create policy "reactions_insert_own" on public.review_reactions for insert to authenticated
  with check (auth.uid() = user_id and not exists (select 1 from public.title_reviews r where r.id = review_id and r.user_id = auth.uid()));
create policy "reactions_delete_own" on public.review_reactions for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------- reports (3 different people hide a review until an admin looks)
create table if not exists public.review_reports (
  id         bigint generated always as identity primary key,
  review_id  uuid not null references public.title_reviews(id) on delete cascade,
  reporter   uuid not null references auth.users(id) on delete cascade,
  reason     text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (review_id, reporter)
);
alter table public.review_reports enable row level security;
drop policy if exists "reports_insert_own"   on public.review_reports;
drop policy if exists "reports_select_admin" on public.review_reports;
create policy "reports_insert_own"   on public.review_reports for insert to authenticated with check (auth.uid() = reporter);
create policy "reports_select_admin" on public.review_reports for select to authenticated using (public.is_admin());

create or replace function public.review_autohide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.review_reports where review_id = new.review_id) >= 3 then
    perform set_config('app.mod', '1', true);
    update public.title_reviews set status = 'hidden' where id = new.review_id and status = 'visible';
  end if;
  return new;
end $$;
drop trigger if exists review_reports_autohide on public.review_reports;
create trigger review_reports_autohide after insert on public.review_reports for each row execute function public.review_autohide();

-- ---------------------------------------------------------------- reading reviews
create or replace function public.title_reviews_list(p_key text, p_sort text default 'felt', p_limit int default 6, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  return jsonb_build_object(
    'total', (select count(*) from public.title_reviews where title_key = p_key and status = 'visible'),
    'items', coalesce((
      select jsonb_agg(to_jsonb(q) - 'sort_felt')
      from (
        select r.id, r.author_name, r.author_icon, r.headline, r.body, r.spoiler, r.created_at,
               (r.user_id = me) as mine,
               (select v.tier from public.title_votes v where v.user_id = r.user_id and v.title_key = r.title_key) as tier,
               (select v.feelings from public.title_votes v where v.user_id = r.user_id and v.title_key = r.title_key) as feelings,
               (select count(*) from public.review_reactions a where a.review_id = r.id) as felt,
               exists (select 1 from public.review_reactions a where a.review_id = r.id and a.user_id = me) as felt_by_me,
               (select count(*) from public.review_reactions a where a.review_id = r.id) as sort_felt
        from public.title_reviews r
        where r.title_key = p_key and r.status = 'visible'
        order by case when p_sort = 'new' then 0 else (select count(*) from public.review_reactions a where a.review_id = r.id) end desc, r.created_at desc
        limit least(greatest(coalesce(p_limit, 6), 1), 20) offset greatest(coalesce(p_offset, 0), 0)
      ) q
    ), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------- admin moderation
create or replace function public.admin_reviews(p_status text default 'all') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'votes',    (select count(*) from public.title_votes),
    'reviews',  (select count(*) from public.title_reviews),
    'hidden',   (select count(*) from public.title_reviews where status = 'hidden'),
    'reported', (select count(distinct review_id) from public.review_reports),
    'items', coalesce((select jsonb_agg(x) from (
      select r.id, r.title_name, r.title_key, r.author_name, r.headline, r.body, r.spoiler, r.status, r.created_at,
             (select count(*) from public.review_reports p where p.review_id = r.id) as reports,
             (select count(*) from public.review_reactions a where a.review_id = r.id) as felt
      from public.title_reviews r
      where p_status = 'all' or (p_status = 'reported' and exists (select 1 from public.review_reports p where p.review_id = r.id)) or r.status = p_status
      order by (select count(*) from public.review_reports p where p.review_id = r.id) desc, r.created_at desc
      limit 200) x), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_review_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_status not in ('visible', 'hidden') then raise exception 'bad status'; end if;
  perform set_config('app.mod', '1', true);
  update public.title_reviews set status = p_status where id = p_id;
end $$;

create or replace function public.admin_review_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  delete from public.title_reviews where id = p_id;
end $$;

-- ---------------------------------------------------------------- permissions
revoke all on function public.title_vote_summary(text), public.title_reviews_list(text, text, int, int), public.admin_reviews(text), public.admin_review_status(uuid, text), public.admin_review_delete(uuid) from public, anon;
grant execute on function public.title_vote_summary(text), public.title_reviews_list(text, text, int, int) to anon, authenticated;
grant execute on function public.admin_reviews(text), public.admin_review_status(uuid, text), public.admin_review_delete(uuid) to authenticated;
