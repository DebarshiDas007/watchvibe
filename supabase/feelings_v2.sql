-- Feelings v2: five tags, ONE per person per title. Run once in Supabase SQL editor (safe to re-run).
-- moved_to_tears, laughed_out_loud, mind_blown, hidden_gem, good_timepass
-- Old votes are mapped: emotional_damage -> moved_to_tears, fun_time -> laughed_out_loud, others keep their name.

alter table public.title_votes drop constraint if exists title_votes_feelings_check;

update public.title_votes
set feelings = case
  when cardinality(feelings) = 0 then '{}'::text[]
  else array[case feelings[1]
               when 'emotional_damage' then 'moved_to_tears'
               when 'fun_time' then 'laughed_out_loud'
               when 'mind_blown' then 'mind_blown'
               when 'hidden_gem' then 'hidden_gem'
               else null end]::text[]
end;
update public.title_votes set feelings = '{}'::text[] where feelings = array[null]::text[];

alter table public.title_votes add constraint title_votes_feelings_check
  check (cardinality(feelings) <= 1 and feelings <@ array['moved_to_tears','laughed_out_loud','mind_blown','hidden_gem','good_timepass']::text[]);

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
