-- Daily Challenge leaderboard (v3: three levels, each a round of 20 timed questions, score up to 200).
-- Run in the Supabase SQL editor. Everything goes through two functions; the table is closed to direct access.
-- Only the FIRST result a person submits for a day and level counts, and only for the current day in India time.

drop function if exists public.daily_submit(date, int, int);
drop function if exists public.daily_board(date);

create table if not exists public.daily_scores (
  day        date        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  score      int         not null default 0 check (score between 0 and 200),
  solved     int         not null default 0 check (solved between 0 and 20),
  created_at timestamptz not null default now()
);
alter table public.daily_scores add column if not exists level text not null default 'medium';
alter table public.daily_scores drop constraint if exists daily_scores_level_check;
alter table public.daily_scores add constraint daily_scores_level_check check (level in ('easy', 'medium', 'hard'));
alter table public.daily_scores drop constraint if exists daily_scores_pkey;
alter table public.daily_scores add primary key (day, user_id, level);
alter table public.daily_scores enable row level security;
revoke all on public.daily_scores from anon, authenticated;

create or replace function public.daily_submit(p_day date, p_level text, p_score int, p_solved int)
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
  if p_level not in ('easy', 'medium', 'hard') then raise exception 'bad level'; end if;
  if p_day <> (now() at time zone 'Asia/Kolkata')::date then raise exception 'wrong day'; end if;
  if p_score < 0 or p_score > 200 or p_solved < 0 or p_solved > 20 then raise exception 'bad score'; end if;
  select coalesce(nullif(trim(p.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''))
    into full_nm
    from auth.users u left join public.profiles p on p.id = u.id where u.id = uid;
  shown := coalesce(
    split_part(full_nm, ' ', 1) || case when split_part(full_nm, ' ', 2) <> '' then ' ' || left(split_part(full_nm, ' ', 2), 1) || '.' else '' end,
    'Player');
  insert into public.daily_scores (day, user_id, level, name, score, solved)
  values (p_day, uid, p_level, left(shown, 24), p_score, p_solved)
  on conflict (day, user_id, level) do nothing;
end $$;

create or replace function public.daily_board(p_day date, p_level text)
returns table (rank bigint, name text, score int, solved int, is_me boolean)
language sql
security definer
set search_path = public
stable
as $$
  select row_number() over (order by s.score desc, s.solved desc, s.created_at) as rank,
         s.name, s.score, s.solved, (s.user_id = auth.uid()) as is_me
  from public.daily_scores s
  where s.day = p_day and s.level = p_level
  order by 1
  limit 20;
$$;

grant execute on function public.daily_submit(date, text, int, int) to authenticated;
grant execute on function public.daily_board(date, text) to anon, authenticated;
