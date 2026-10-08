-- Bug Hunt Race: API functions and leaderboard view (TB-23).
--
-- Clients never insert players or scores directly. These functions run as
-- the table owner (security definer), check the caller with auth.uid(), and
-- raise an exception whose message is a stable error code that lib/db maps
-- to a typed error:
--   not_authenticated, invalid_display_name, invalid_avatar,
--   invalid_total_rounds, room_not_found, room_locked, room_full,
--   room_code_exhausted, round_not_found, round_not_live

-- Private helpers -----------------------------------------------------------

create function private.max_players_per_room()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 50;
$$;

-- 6 random chars from the 32-char alphabet A-Z + 2-9 minus 0/O/1/I.
-- 256 is a multiple of 32, so `byte % 32` is unbiased. Bytes 0-5 of a v4
-- UUID are fully random (version bits sit in bytes 6 and 8).
create function private.generate_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea := uuid_send(gen_random_uuid());
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(random_bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Trim, collapse inner whitespace, and enforce 1-24 visible characters.
create function private.clean_display_name(raw_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text := regexp_replace(btrim(coalesce(raw_name, '')), '\s+', ' ', 'g');
begin
  if char_length(cleaned) not between 1 and 24 or cleaned ~ '[[:cntrl:]]' then
    raise exception 'invalid_display_name' using errcode = 'P0001';
  end if;
  return cleaned;
end;
$$;

-- "Riya" -> "Riya (2)" -> "Riya (3)" ... Case-insensitive, like the unique
-- index. Callers must hold a lock on the room row.
create function private.unique_display_name(target_room_id uuid, wanted_name text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  candidate text := wanted_name;
  suffix integer := 1;
begin
  while exists (
    select 1
    from public.players
    where room_id = target_room_id
      and lower(display_name) = lower(candidate)
  ) loop
    suffix := suffix + 1;
    candidate := wanted_name || ' (' || suffix || ')';
  end loop;
  return candidate;
end;
$$;

create function private.check_avatar(avatar text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if avatar is null or char_length(btrim(avatar)) not between 1 and 16 then
    raise exception 'invalid_avatar' using errcode = 'P0001';
  end if;
  return btrim(avatar);
end;
$$;

-- Score = base points + speed bonus - hint penalty (TB-19 section 3).
--   speed bonus:  up to +50% of base, linear in the share of time left
--   hint penalty: -25% of base
-- Unsolved rounds score 0 (handled by the caller). Task 13 (scoring) may
-- tune these numbers in a later migration.
create function private.calculate_points(
  base_points integer,
  time_limit_seconds integer,
  solve_time_ms integer,
  hint_used boolean
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(
    0,
    base_points
      + floor(
          base_points * 0.5
          * greatest(0, time_limit_seconds * 1000 - solve_time_ms)
          / (time_limit_seconds * 1000.0)
        )::integer
      - case when hint_used then floor(base_points * 0.25)::integer else 0 end
  );
$$;

-- find_open_room: what the join screen needs before the player picks a name.
-- Returns no row when the code is unknown or the room is closed. Callable
-- before sign-in, and returns nothing a non-member should not see.

create function public.find_open_room(room_code text)
returns table (
  code text,
  status public.room_status,
  locked boolean,
  is_full boolean,
  language public.language_id,
  level public.room_level,
  player_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.code,
    r.status,
    r.locked,
    count(p.id) >= private.max_players_per_room(),
    r.language,
    r.level,
    count(p.id)::integer
  from public.rooms r
  left join public.players p on p.room_id = r.id
  where r.code = upper(btrim(room_code))
    and r.status <> 'closed'
  group by r.id;
$$;

-- create_room: new room in the lobby + the caller as its admin player.

create function public.create_room(
  room_language public.language_id,
  room_level public.room_level,
  display_name text,
  avatar text,
  -- null (the default) = play until the admin stops.
  room_total_rounds integer default null
)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_name text;
  clean_avatar text;
  new_room public.rooms;
  admin_player public.players;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if room_total_rounds is not null and room_total_rounds not between 1 and 50 then
    raise exception 'invalid_total_rounds' using errcode = 'P0001';
  end if;
  clean_name := private.clean_display_name(display_name);
  clean_avatar := private.check_avatar(avatar);

  -- Retry on the rare code collision with another open room.
  for attempt in 1..10 loop
    begin
      insert into public.rooms (code, language, level, total_rounds)
      values (private.generate_room_code(), room_language, room_level, room_total_rounds)
      returning * into new_room;
      exit;
    exception when unique_violation then
      if attempt = 10 then
        raise exception 'room_code_exhausted' using errcode = 'P0001';
      end if;
    end;
  end loop;

  insert into public.players (room_id, user_id, display_name, avatar)
  values (new_room.id, caller, clean_name, clean_avatar)
  returning * into admin_player;

  update public.rooms set admin_player_id = admin_player.id where id = new_room.id;

  -- Re-read: the sync trigger has set is_admin.
  select * into admin_player from public.players where id = admin_player.id;
  return admin_player;
end;
$$;

-- join_room: add the caller to an open room, or return their existing player
-- (rejoin after a dropped connection keeps name and score, even when the
-- room is locked or full).

create function public.join_room(room_code text, display_name text, avatar text)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_room public.rooms;
  joined public.players;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Lock the room so concurrent joins see each other's names and count.
  select * into target_room
  from public.rooms
  where code = upper(btrim(room_code))
    and status <> 'closed'
  for update;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  update public.players
  set connected = true
  where room_id = target_room.id
    and user_id = caller
  returning * into joined;
  if found then
    return joined;
  end if;

  if target_room.locked then
    raise exception 'room_locked' using errcode = 'P0001';
  end if;
  if (select count(*) from public.players where room_id = target_room.id)
      >= private.max_players_per_room() then
    raise exception 'room_full' using errcode = 'P0001';
  end if;

  insert into public.players (room_id, user_id, display_name, avatar)
  values (
    target_room.id,
    caller,
    private.unique_display_name(target_room.id, private.clean_display_name(display_name)),
    private.check_avatar(avatar)
  )
  returning * into joined;
  return joined;
end;
$$;

-- record_score: the caller reports their result for the live round. Time and
-- points are computed here from the server clock, so the client cannot
-- choose them. A passing result is final; earlier non-passing rows (e.g. a
-- hint was used) can be upgraded. Hints stay used once used.

create function public.record_score(round_id uuid, passed boolean, hint_used boolean)
returns public.scores
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  -- Small allowance for network latency after the deadline.
  grace_ms constant integer := 5000;
  target_round public.rounds;
  room_status public.room_status;
  puzzle public.puzzles;
  me public.players;
  existing public.scores;
  elapsed_ms bigint;
  any_hint boolean;
  result public.scores;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into target_round from public.rounds r where r.id = record_score.round_id;
  if found then
    select * into me
    from public.players p
    where p.room_id = target_round.room_id
      and p.user_id = caller;
  end if;
  -- Same error for "no such round" and "not your room": do not leak rounds.
  if me.id is null then
    raise exception 'round_not_found' using errcode = 'P0001';
  end if;

  select * into existing
  from public.scores s
  where s.round_id = target_round.id
    and s.player_id = me.id
  for update;
  if existing.passed then
    return existing;
  end if;

  select r.status into room_status from public.rooms r where r.id = target_round.room_id;
  select * into puzzle from public.puzzles z where z.id = target_round.puzzle_id;
  elapsed_ms := floor(extract(epoch from (now() - target_round.started_at)) * 1000)::bigint
    - target_round.paused_ms;

  if room_status <> 'round_live'
      or target_round.ended_at is not null
      or target_round.paused_at is not null
      or elapsed_ms > puzzle.time_limit_seconds * 1000 + grace_ms then
    raise exception 'round_not_live' using errcode = 'P0001';
  end if;

  elapsed_ms := least(greatest(elapsed_ms, 0), puzzle.time_limit_seconds * 1000);
  any_hint := coalesce(existing.hint_used, false) or coalesce(record_score.hint_used, false);

  insert into public.scores as s
    (round_id, player_id, passed, solve_time_ms, hint_used, points, submitted_at)
  values (
    target_round.id,
    me.id,
    coalesce(record_score.passed, false),
    case when record_score.passed then elapsed_ms::integer end,
    any_hint,
    case
      when record_score.passed
        then private.calculate_points(puzzle.base_points, puzzle.time_limit_seconds, elapsed_ms::integer, any_hint)
      else 0
    end,
    now()
  )
  -- Merge with a row a concurrent call may have inserted since the read
  -- above: keep its hint and recompute the points with it.
  on conflict on constraint scores_round_player_key do update
    set passed = excluded.passed,
        solve_time_ms = excluded.solve_time_ms,
        hint_used = s.hint_used or excluded.hint_used,
        points = case
          when excluded.passed then private.calculate_points(
            puzzle.base_points,
            puzzle.time_limit_seconds,
            excluded.solve_time_ms,
            s.hint_used or excluded.hint_used
          )
          else 0
        end,
        submitted_at = excluded.submitted_at
    where not s.passed
  returning * into result;

  -- A concurrent call already stored a pass; return that.
  if result.id is null then
    select * into result
    from public.scores s
    where s.round_id = target_round.id
      and s.player_id = me.id;
  end if;
  return result;
end;
$$;

-- Function privileges ----------------------------------------------------------
-- Supabase lets anon/authenticated execute new functions by default; lock
-- them down and grant back only the API functions.

revoke all on function private.max_players_per_room() from public, anon, authenticated;
revoke all on function private.generate_room_code() from public, anon, authenticated;
revoke all on function private.clean_display_name(text) from public, anon, authenticated;
revoke all on function private.unique_display_name(uuid, text) from public, anon, authenticated;
revoke all on function private.check_avatar(text) from public, anon, authenticated;
revoke all on function private.calculate_points(integer, integer, integer, boolean)
  from public, anon, authenticated;

revoke all on function public.find_open_room(text) from public, anon, authenticated;
revoke all on function public.create_room(public.language_id, public.room_level, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.join_room(text, text, text) from public, anon, authenticated;
revoke all on function public.record_score(uuid, boolean, boolean) from public, anon, authenticated;

grant execute on function public.find_open_room(text) to anon, authenticated;
grant execute on function public.create_room(public.language_id, public.room_level, text, text, integer)
  to authenticated;
grant execute on function public.join_room(text, text, text) to authenticated;
grant execute on function public.record_score(uuid, boolean, boolean) to authenticated;

-- Leaderboard ----------------------------------------------------------------
-- security_invoker: the caller's RLS applies, so you only see your own rooms.
-- Rank: total points, then total solve time (faster wins). Exact ties share
-- the place (rank(), not row_number()).

create view public.room_leaderboard
with (security_invoker = true)
as
select
  p.room_id,
  p.id as player_id,
  p.display_name,
  p.avatar,
  p.is_admin,
  p.connected,
  coalesce(sum(s.points), 0)::integer as total_points,
  (count(s.id) filter (where s.passed))::integer as rounds_solved,
  coalesce(sum(s.solve_time_ms), 0)::integer as total_solve_ms,
  (rank() over (
    partition by p.room_id
    order by coalesce(sum(s.points), 0) desc, coalesce(sum(s.solve_time_ms), 0) asc
  ))::integer as rank
from public.players p
left join public.scores s on s.player_id = p.id
group by p.id;

revoke all on table public.room_leaderboard from anon, authenticated;
grant select on table public.room_leaderboard to authenticated;
