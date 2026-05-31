-- =====================================================
-- Mandi Compass - Supabase Schema
-- Run this in the Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================================================
-- CONQUESTS TABLE (User visits / Hall of Fame posts)
-- =====================================================
create table public.conquests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  spot_name text not null,
  spot_address text not null,
  lat double precision not null,
  lng double precision not null,
  photo_url text not null,
  authenticity_rating numeric(2,1) check (authenticity_rating >= 1 and authenticity_rating <= 5),
  distance_walked integer,
  claimed_at timestamptz not null default now(),
  badge text check (badge in ('bronze', 'silver', 'gold')) not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.conquests enable row level security;

-- Policies
create policy "Public can view all conquests"
  on public.conquests for select
  using (true);

create policy "Users can insert their own conquests"
  on public.conquests for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conquests"
  on public.conquests for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conquests"
  on public.conquests for delete
  using (auth.uid() = user_id);

-- =====================================================
-- USER ACHIEVEMENTS TABLE
-- =====================================================
create table public.user_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  achievement_id text not null, -- e.g. 'first', 'night', 'long', 'auth', 'gold', 'multi'
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "Users can view their own achievements"
  on public.user_achievements for select
  using (auth.uid() = user_id);

create policy "Users can insert their own achievements"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

-- =====================================================
-- INDEXES for performance
-- =====================================================
create index idx_conquests_user_id on public.conquests(user_id);
create index idx_conquests_claimed_at on public.conquests(claimed_at desc);
create index idx_user_achievements_user_id on public.user_achievements(user_id);

-- =====================================================
-- STORAGE BUCKET for conquest photos
-- =====================================================
-- Go to Storage in Supabase dashboard and create a bucket called "conquest-photos"
-- Make it public (or use signed URLs later for more control).
-- Recommended policy for the bucket (in Storage policies):
--   - Anyone can SELECT (view images)
--   - Authenticated users can INSERT into their own folder (optional organization)

-- Example RLS for storage (run after creating bucket):
-- You can also set this in the dashboard under Storage > Policies

-- =====================================================
-- OPTIONAL: Function to get public profile info (if you add user profiles later)
-- =====================================================

-- For now this schema gives us:
-- 1. Public Hall of Fame feed (query conquests + join with auth.users if you want display names later)
-- 2. Per-user achievements stored server-side
-- 3. Photos stored in Supabase Storage

comment on table public.conquests is 'User conquests / visits. Powers the Hall of Fame and personal history.';
comment on table public.user_achievements is 'Unlocked achievements per user. Synced from client logic or calculated server-side.';