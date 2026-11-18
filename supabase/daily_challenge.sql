-- Daily Challenge ("Guess the film") leaderboard.
-- Run once in the Supabase SQL editor. Everything goes through two functions: the table itself is not readable or writable directly.
-- Only the FIRST result a person submits for a day counts, and only for the current day in India time.

create table if not exists public.daily_scores (
  day        date        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  tries      int         not null check (tries between 1 and 5),
  won        boolean     not null,
  created_at timestamptz not null default now(),
  primary key (day, user_id)
);

alter table public.daily_scores enable row level security;
revoke all on public.daily_scores from anon, authenticated;

create or replace function public.daily_submit(p_day date, p_tries int, p_won boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  full_nm text;
  shown text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_day <> (now() at time zone 'Asia/Kolkata')::date then raise exception 'wrong day'; end if;
  if p_tries < 1 or p_tries > 5 then raise exception 'bad tries'; end if;
  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''))
    into full_nm
    from auth.users u left join public.profiles p on p.id = u.id where u.id = uid;
  -- first name and the initial of the second word, e.g. "Debarshi D."
  shown := coalesce(
    split_part(full_nm, ' ', 1) || case when split_part(full_nm, ' ', 2) <> '' then ' ' || left(split_part(full_nm, ' ', 2), 1) || '.' else '' end,
    'Player');
  insert into public.daily_scores (day, user_id, name, tries, won)
  values (p_day, uid, left(shown, 24), p_tries, p_won)
  on conflict (day, user_id) do nothing;
end $$;

create or replace function public.daily_board(p_day date)
returns table (rank bigint, name text, tries int, won boolean, is_me boolean)
language sql
security definer
set search_path = public
stable
as $$
  select row_number() over (order by (case when s.won then 0 else 1 end), s.tries, s.created_at) as rank,
         s.name, s.tries, s.won, (s.user_id = auth.uid()) as is_me
  from public.daily_scores s
  where s.day = p_day
  order by 1
  limit 20;
$$;

grant execute on function public.daily_submit(date, int, boolean) to authenticated;
grant execute on function public.daily_board(date) to anon, authenticated;
