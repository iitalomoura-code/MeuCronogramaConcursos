-- Coach reviews describe the strategy of one concrete study plan. Existing
-- rows remain intentionally unscoped: legacy memory must not be guessed into
-- a newly activated plan.
alter table public.ai_coach_reviews
  add column if not exists study_context_id text;

create index if not exists ai_coach_reviews_user_context_created_idx
  on public.ai_coach_reviews(user_id, study_context_id, created_at desc);

create index if not exists ai_coach_reviews_user_context_mode_created_idx
  on public.ai_coach_reviews(user_id, study_context_id, mode, created_at desc);

create index if not exists ai_coach_reviews_user_context_cycle_idx
  on public.ai_coach_reviews(user_id, study_context_id, cycle_id);
