create table if not exists public.user_knowledge_bases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_knowledge_bases enable row level security;

create policy "Users manage their own knowledge base"
  on public.user_knowledge_bases
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
