-- WatchVibe Supabase schema + Row Level Security.
-- Run once in: Supabase Dashboard -> SQL Editor.
-- Safe to re-run (idempotent). Review the DROP statements before running on a DB with other data.
--
-- Security model: the browser only ever holds the public anon key. Everything is enforced here with RLS,
-- keyed on auth.uid() from a verified Supabase Auth JWT. The old design keyed rows on a typed-in email
-- (no verification) and must not be used.

-- ---------------------------------------------------------------- legacy tables
-- The first prototype created user_watchlists / battle_votes / vibe_ratings with a different shape
-- (item_id / voted_item_id columns). Keep that data, but move it out of the way (reversible rename).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_watchlists' and column_name='item_id') then
    alter table public.user_watchlists rename to user_watchlists_legacy;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='battle_votes' and column_name='voted_item_id') then
    alter table public.battle_votes rename to battle_votes_legacy;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='vibe_ratings' and column_name='item_id') then
    alter table public.vibe_ratings rename to vibe_ratings_legacy;
  end if;
end $$;

-- Legacy tables must not stay world-accessible through the API.
do $$
declare t text;
begin
  foreach t in array array['user_watchlists_legacy','battle_votes_legacy','vibe_ratings_legacy'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- Drop the prototype's permissive policies (e.g. "Public profiles are viewable by everyone"), which would
-- otherwise defeat the admin-only profile policy below. Legacy tables end up with RLS on and no policies (deny all).
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
    where schemaname='public'
      and (tablename in ('user_watchlists_legacy','battle_votes_legacy','vibe_ratings_legacy')
           or (tablename='profiles' and policyname not in ('profiles_select_own','profiles_select_admin','profiles_update_own')))
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Legacy tables may have used `username` as the email column; add the new columns if missing.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

-- Admin: only a JWT whose email is the admin address AND is verified may read every profile.
-- (email_verified lives in user_metadata for Supabase-issued JWTs; OAuth/magic-link emails are verified.)
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (
    lower(auth.jwt() ->> 'email') = 'dasdebarshi1234@gmail.com'
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false)
  );

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Create the profile automatically when a user signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- user_watchlists
-- One row per user; `watchlist_data` is the JSON blob the web app syncs.
-- If you have an older table keyed on email (user_id text), back it up and drop it first:
--   alter table public.user_watchlists rename to user_watchlists_legacy;
create table if not exists public.user_watchlists (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  watchlist_data  jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table public.user_watchlists enable row level security;

drop policy if exists "watchlists_own_all" on public.user_watchlists;
create policy "watchlists_own_all" on public.user_watchlists
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- battle_votes
create table if not exists public.battle_votes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  battle_id  text not null,
  voted_for  text not null check (voted_for in ('A', 'B')),
  created_at timestamptz not null default now(),
  primary key (user_id, battle_id)
);

alter table public.battle_votes enable row level security;

drop policy if exists "battle_votes_select_all" on public.battle_votes;
drop policy if exists "battle_votes_write_own"  on public.battle_votes;
create policy "battle_votes_select_all" on public.battle_votes
  for select to anon, authenticated using (true);
create policy "battle_votes_write_own" on public.battle_votes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- vibe_ratings
create table if not exists public.vibe_ratings (
  user_id    uuid not null references auth.users(id) on delete cascade,
  media_id   text not null,
  vibes      text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

alter table public.vibe_ratings enable row level security;

drop policy if exists "vibe_ratings_select_all" on public.vibe_ratings;
drop policy if exists "vibe_ratings_write_own"  on public.vibe_ratings;
create policy "vibe_ratings_select_all" on public.vibe_ratings
  for select to anon, authenticated using (true);
create policy "vibe_ratings_write_own" on public.vibe_ratings
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
