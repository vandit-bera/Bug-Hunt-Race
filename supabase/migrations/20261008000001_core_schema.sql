-- Bug Hunt Race: core tables (TB-23).
-- Data model and ER diagram: docs/ARCHITECTURE.md.
-- Row-level security and API functions live in the next migrations.

-- Enums --------------------------------------------------------------------

-- Same ids as RoomState in lib/game/types.ts.
create type public.room_status as enum (
  'lobby',
  'countdown',
  'round_live',
  'paused',
  'round_results',
  'final_leaderboard',
  'closed'
);

-- Same ids as LanguageId in lib/runner/types.ts.
create type public.language_id as enum ('javascript', 'typescript', 'python');

-- A puzzle has one level; a room can also be 'mixed' (gets harder each round).
create type public.puzzle_level as enum ('easy', 'medium', 'hard');
create type public.room_level as enum ('easy', 'medium', 'hard', 'mixed');

-- Shared trigger: keep updated_at current ----------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rooms --------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- 6 chars from A-Z and 2-9 without the look-alikes 0, O, 1, I.
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- Set right after the admin's player row is created (see create_room).
  admin_player_id uuid,
  status public.room_status not null default 'lobby',
  language public.language_id not null,
  level public.room_level not null,
  -- null = "play until I stop".
  total_rounds integer check (total_rounds between 1 and 50),
  locked boolean not null default false,
  -- 0 until the first round starts.
  current_round integer not null default 0 check (current_round >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint rooms_closed_at_matches_status
    check ((status = 'closed') = (closed_at is not null))
);

comment on table public.rooms is 'One race room. Created by create_room().';
comment on column public.rooms.total_rounds is 'null = play until the admin stops.';

-- Codes only need to be unique among rooms that are not closed, so a closed
-- room's code can be reused. This index also serves the join-by-code lookup.
create unique index rooms_open_code_key on public.rooms (code)
  where status <> 'closed';

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- Stamp closed_at when a room closes; clear it if a closed room is reopened.
create function public.set_room_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at := now();
  elsif new.status <> 'closed' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger rooms_set_closed_at
  before update of status on public.rooms
  for each row execute function public.set_room_closed_at();

-- Players ------------------------------------------------------------------

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  -- Supabase anonymous-auth user behind this player. One player per user
  -- per room, so rejoining after a dropped connection keeps the score.
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Up to 24 chars typed by the player, plus a " (n)" suffix for duplicates.
  display_name text not null
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 30),
  avatar text not null check (char_length(avatar) between 1 and 16),
  -- Mirrors rooms.admin_player_id; maintained by a trigger, never written directly.
  is_admin boolean not null default false,
  connected boolean not null default true,
  joined_at timestamptz not null default now(),
  constraint players_room_user_key unique (room_id, user_id),
  -- Target for rooms' composite admin FK below.
  constraint players_id_room_key unique (id, room_id)
);

comment on table public.players is 'A person in a room. Created by create_room() / join_room().';

-- "Riya" and "riya" count as the same name.
create unique index players_room_name_key on public.players (room_id, lower(display_name));
-- At most one admin per room.
create unique index players_one_admin_per_room on public.players (room_id) where is_admin;
create index players_user_id_idx on public.players (user_id);

-- The admin must be a player in the same room.
alter table public.rooms
  add constraint rooms_admin_player_fkey
  foreign key (admin_player_id, id) references public.players (id, room_id)
  on delete set null (admin_player_id);

-- Keep players.is_admin in sync with rooms.admin_player_id.
create function public.sync_room_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Clear the old admin first: players_one_admin_per_room is checked per row.
  update public.players
  set is_admin = false
  where room_id = new.id
    and is_admin
    and id is distinct from new.admin_player_id;
  update public.players
  set is_admin = true
  where id = new.admin_player_id
    and not is_admin;
  return null;
end;
$$;

create trigger rooms_sync_admin
  after insert or update of admin_player_id on public.rooms
  for each row execute function public.sync_room_admin();

-- Puzzles ------------------------------------------------------------------

create table public.puzzles (
  -- Slug from the puzzle file in puzzles/, e.g. 'js-easy-sum-array'.
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  language public.language_id not null,
  level public.puzzle_level not null,
  title text not null check (char_length(title) between 1 and 120),
  buggy_code text not null,
  tests text not null,
  hint text,
  time_limit_seconds integer not null check (time_limit_seconds between 30 and 1800),
  base_points integer not null,
  created_at timestamptz not null default now(),
  constraint puzzles_base_points_match_level check (
    (level = 'easy' and base_points = 100)
    or (level = 'medium' and base_points = 200)
    or (level = 'hard' and base_points = 300)
  )
);

comment on table public.puzzles is
  'Buggy snippets players fix. The reference fix is deliberately NOT stored here: it stays in puzzles/ for the CI checker.';

create index puzzles_language_level_idx on public.puzzles (language, level);

-- Rounds -------------------------------------------------------------------

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  puzzle_id text not null references public.puzzles (id),
  round_number integer not null check (round_number >= 1),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Set while the round is paused; null when running.
  paused_at timestamptz,
  -- Total paused time from earlier pauses, added to the deadline.
  paused_ms integer not null default 0 check (paused_ms >= 0),
  constraint rounds_room_number_key unique (room_id, round_number),
  constraint rounds_ended_after_start check (ended_at is null or ended_at >= started_at)
);

comment on table public.rounds is 'One puzzle played in a room.';

create index rounds_puzzle_id_idx on public.rounds (puzzle_id);

-- Scores -------------------------------------------------------------------

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  passed boolean not null default false,
  -- Server-measured time from round start to the passing submission,
  -- excluding pauses. null until passed.
  solve_time_ms integer check (solve_time_ms >= 0),
  hint_used boolean not null default false,
  points integer not null default 0 check (points >= 0),
  -- Server timestamp of the latest submission; breaks ties.
  submitted_at timestamptz not null default now(),
  constraint scores_round_player_key unique (round_id, player_id),
  constraint scores_solve_time_when_passed check (passed = (solve_time_ms is not null))
);

comment on table public.scores is 'A player''s result for one round. Written only by record_score().';

create index scores_player_id_idx on public.scores (player_id);
