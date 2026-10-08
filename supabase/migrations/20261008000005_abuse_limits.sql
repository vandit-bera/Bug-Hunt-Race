-- Bug Hunt Race: abuse limits (TB-41).
--
-- 1. Room creation: at most 10 rooms per user per rolling hour. Enforced by a
--    trigger on rooms, so it holds whichever function creates the room.
--    Error: rate_limited.
-- 2. Display names and avatars: no '<' or '>' (no HTML). Length limits were
--    already enforced (names 1-24 chars, avatars 1-16).
--
-- Not enforced here (see docs/ARCHITECTURE.md#abuse-limits): new anonymous
-- users per IP (a Supabase Auth setting), joins (rooms are capped at 50
-- players), Realtime messages.

-- Room creation rate limit ---------------------------------------------------

create function private.max_rooms_per_hour()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 10;
$$;

-- One row per room a user created in the last hour (older rows are pruned on
-- that user's next create).
create table private.room_creations (
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index room_creations_user_time_idx on private.room_creations (user_id, created_at);

alter table private.room_creations enable row level security;
revoke all on table private.room_creations from public, anon, authenticated;

create function private.limit_room_creation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- Migrations, the seed and tests insert rooms without a user.
  if caller is null then
    return new;
  end if;
  -- Serialise each user's creates so two parallel calls cannot both pass.
  perform pg_advisory_xact_lock(hashtextextended('room_creations:' || caller::text, 0));
  delete from private.room_creations
  where user_id = caller and created_at <= now() - interval '1 hour';
  if (select count(*) from private.room_creations where user_id = caller)
     >= private.max_rooms_per_hour() then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- Rolled back with the room if the insert fails (e.g. a code collision).
  insert into private.room_creations (user_id) values (caller);
  return new;
end;
$$;

create trigger rooms_limit_creation
  before insert on public.rooms
  for each row execute function private.limit_room_creation();

revoke all on function private.max_rooms_per_hour() from public, anon, authenticated;
revoke all on function private.limit_room_creation() from public, anon, authenticated;

-- No HTML in names or avatars --------------------------------------------------
-- Same signatures as 20261008000003, so callers and grants are unchanged.

create or replace function private.clean_display_name(raw_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text := regexp_replace(btrim(coalesce(raw_name, '')), '\s+', ' ', 'g');
begin
  if char_length(cleaned) not between 1 and 24
     or cleaned ~ '[[:cntrl:]]'
     or cleaned ~ '[<>]' then
    raise exception 'invalid_display_name' using errcode = 'P0001';
  end if;
  return cleaned;
end;
$$;

create or replace function private.check_avatar(avatar text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if avatar is null
     or char_length(btrim(avatar)) not between 1 and 16
     or avatar ~ '[<>]' then
    raise exception 'invalid_avatar' using errcode = 'P0001';
  end if;
  return btrim(avatar);
end;
$$;
