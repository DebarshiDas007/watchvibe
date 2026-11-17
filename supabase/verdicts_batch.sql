-- Community verdict totals for many titles at once (used on the Want to watch page).
-- Run once in Supabase SQL editor. Safe to re-run. Returns only totals per title, never who voted.
create or replace function public.title_verdicts(p_keys text[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', title_key, 'total', n, 'tiers', tiers)), '[]'::jsonb)
  from (
    select title_key, count(*) as n,
           jsonb_build_array(
             count(*) filter (where tier = 1), count(*) filter (where tier = 2), count(*) filter (where tier = 3),
             count(*) filter (where tier = 4), count(*) filter (where tier = 5), count(*) filter (where tier = 6)) as tiers
    from public.title_votes
    where title_key = any (p_keys[1:200])
    group by title_key
  ) q;
$$;
revoke all on function public.title_verdicts(text[]) from public;
grant execute on function public.title_verdicts(text[]) to anon, authenticated;
