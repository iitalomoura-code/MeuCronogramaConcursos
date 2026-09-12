create table if not exists public.ai_coach_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('cycle-review', 'progress-check', 'question')),
  question text,
  snapshot_signature text not null,
  ai_read_contract_version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  review_json jsonb not null,
  meta_json jsonb not null default '{}'::jsonb,
  checkpoint_json jsonb not null,
  previous_review_id uuid references public.ai_coach_reviews(id),
  previous_cycle_review_id uuid references public.ai_coach_reviews(id),
  cycle_id text,
  cycle_reference_at timestamptz,
  model text,
  status text not null default 'completed',
  constraint ai_coach_reviews_question_length check (question is null or char_length(question) <= 2000)
);

create index if not exists ai_coach_reviews_user_created_idx on public.ai_coach_reviews(user_id, created_at desc);
create index if not exists ai_coach_reviews_user_mode_created_idx on public.ai_coach_reviews(user_id, mode, created_at desc);
create index if not exists ai_coach_reviews_user_cycle_idx on public.ai_coach_reviews(user_id, cycle_id);

alter table public.ai_coach_reviews enable row level security;

drop policy if exists "ai coach reviews own select" on public.ai_coach_reviews;
create policy "ai coach reviews own select" on public.ai_coach_reviews
  for select using (auth.uid() = user_id);

drop policy if exists "ai coach reviews own insert" on public.ai_coach_reviews;
create policy "ai coach reviews own insert" on public.ai_coach_reviews
  for insert with check (auth.uid() = user_id);
