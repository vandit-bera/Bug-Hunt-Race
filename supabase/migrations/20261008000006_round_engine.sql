-- Bug Hunt Race: race round engine (TB-53).
--
--   * Puzzle catalog: `puzzles` gets `description` and `active`. The rows
--     come from puzzles/ through the generated supabase/puzzles.sql (see
--     docs/ARCHITECTURE.md#puzzle-catalog). Still no reference fix here.
--   * Games: `rooms.game_number` goes up on Play again; rounds are numbered
--     per game, so a room can play round 1 again in its next game.
--   * Round lifecycle, applied by the same room events as before:
--       begin_round   picks the puzzle and inserts the round (server clock)
--       pause/resume  freeze and unfreeze the round clock
--       end_round, stop, abandon   end the round
--     The database also ends the round by itself (as if the admin skipped)
--     when every player who was in at the start has a result, or when the
--     time is up. It checks on every result and every heartbeat.
--   * record_score: one result per player per round, refused after the round
--     ends and for players who joined after it started.
--   * get_current_round: the round, its puzzle and the server's clock.
--   * reveal_round_puzzle: the puzzle id of an ended round, for the fix
--     reveal route (app/api/rounds/[roundId]/fix), which holds the fixes.
--
-- New error codes: no_puzzles, joined_late, already_submitted, round_not_over.

-- Puzzles ------------------------------------------------------------------------

alter table public.puzzles
  add column description text,
  add column active boolean not null default true;

comment on column public.puzzles.description is 'What the code is supposed to do.';
comment on column public.puzzles.active is
  'false = no longer in puzzles/: kept for old rounds, never picked again.';

-- Games and rounds -----------------------------------------------------------------

alter table public.rooms
  add column game_number integer not null default 1 check (game_number >= 1);

comment on column public.rooms.game_number is 'Goes up by one on Play again.';

alter table public.rounds
  add column game_number integer not null default 1 check (game_number >= 1);

alter table public.rounds drop constraint rounds_room_number_key;
alter table public.rounds
  add constraint rounds_room_game_number_key unique (room_id, game_number, round_number);

-- A room plays one round at a time.
create unique index rounds_one_open_per_room on public.rounds (room_id)
  where ended_at is null;

-- Settings -----------------------------------------------------------------------

-- Results that arrive this long after the deadline still count (network lag).
-- The round ends by itself once it has passed.
create function private.submit_grace_ms()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 5000;
$$;

-- Round clock --------------------------------------------------------------------

-- Milliseconds between two timestamps.
create function private.ms_between(from_time timestamptz, to_time timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select floor(extract(epoch from (to_time - from_time)) * 1000)::bigint;
$$;

-- Play time so far, without pauses (also while paused: the clock is frozen).
create function private.round_elapsed_ms(target public.rounds, at_time timestamptz)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select private.ms_between(
    target.started_at,
    coalesce(target.ended_at, target.paused_at, at_time)
  ) - target.paused_ms;
$$;

-- Puzzle picking -------------------------------------------------------------------

-- Levels to try for a round, best first. A fixed level only plays that level.
-- Mixed plays Easy in round 1, Medium in round 2 and Hard from round 3; a
-- level with no puzzles falls back to a harder one, then an easier one.
create function private.levels_for_round(room_level public.room_level, round_number integer)
returns public.puzzle_level[]
language sql
immutable
set search_path = ''
as $$
  select case
    when room_level <> 'mixed' then array[room_level::text::public.puzzle_level]
    when round_number <= 1 then array['easy', 'medium', 'hard']::public.puzzle_level[]
    when round_number = 2 then array['medium', 'hard', 'easy']::public.puzzle_level[]
    else array['hard', 'medium', 'easy']::public.puzzle_level[]
  end;
$$;

-- Picks the puzzle for the room's current round: an active puzzle in the
-- room's language and level that this game has not played yet, at random.
-- Once a level's pool is used up, the least-played puzzles come back, but
-- never the one just played (unless it is the only one).
create function private.pick_puzzle(target_room public.rooms)
returns public.puzzles
language plpgsql
volatile
set search_path = ''
as $$
declare
  wanted public.puzzle_level;
  last_puzzle_id text;
  picked public.puzzles;
begin
  select r.puzzle_id into last_puzzle_id
  from public.rounds r
  where r.room_id = target_room.id
    and r.game_number = target_room.game_number
  order by r.round_number desc
  limit 1;

  foreach wanted in array private.levels_for_round(target_room.level, target_room.current_round) loop
    select z.* into picked
    from public.puzzles z
    where z.language = target_room.language
      and z.level = wanted
      and z.active
    order by
      (
        select count(*)
        from public.rounds r
        where r.room_id = target_room.id
          and r.game_number = target_room.game_number
          and r.puzzle_id = z.id
      ),
      z.id is not distinct from last_puzzle_id,
      random()
    limit 1;
    if found then
      return picked;
    end if;
  end loop;

  raise exception 'no_puzzles' using errcode = 'P0001';
end;
$$;

-- Round lifecycle ------------------------------------------------------------------

-- Ends the room's open round, if any: a pause in progress counts as paused
-- time, so the solve times and the clock stay right.
create function private.end_open_round(target_room_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.rounds r
  set paused_ms = r.paused_ms + coalesce(private.ms_between(r.paused_at, now()), 0),
      paused_at = null,
      ended_at = now()
  where r.room_id = target_room_id
    and r.ended_at is null;
$$;

-- Same signature and rules as in 20261008000004; now also starts, pauses,
-- resumes and ends rounds, and counts games.
create or replace function private.apply_room_event(
  target_room_id uuid,
  room_event public.room_event,
  actor text
)
returns public.rooms
language plpgsql
volatile
set search_path = ''
as $$
declare
  target public.rooms;
  rule private.room_transitions;
  new_round integer;
  puzzle public.puzzles;
  result public.rooms;
begin
  select * into target from public.rooms where id = target_room_id for update;
  if not found then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  select * into rule
  from private.room_transitions t
  where t.from_status = target.status
    and t.event = room_event;
  if not found
      or rule.actor <> apply_room_event.actor
      or (room_event = 'next_round'
          and target.total_rounds is not null
          and target.current_round >= target.total_rounds)
      or (room_event = 'finish'
          and target.total_rounds is not null
          and target.current_round < target.total_rounds) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  new_round := case
    when room_event in ('start', 'next_round') then target.current_round + 1
    when room_event = 'play_again' then 0
    else target.current_round
  end;

  case room_event
    when 'begin_round' then
      puzzle := private.pick_puzzle(target);
      -- started_at defaults to now(): the server's clock, never the client's.
      insert into public.rounds (room_id, puzzle_id, game_number, round_number)
      values (target.id, puzzle.id, target.game_number, target.current_round);
    when 'pause' then
      update public.rounds
      set paused_at = now()
      where room_id = target.id
        and ended_at is null;
    when 'resume' then
      update public.rounds r
      set paused_ms = r.paused_ms + private.ms_between(r.paused_at, now()),
          paused_at = null
      where r.room_id = target.id
        and r.ended_at is null;
    when 'end_round', 'stop', 'abandon' then
      perform private.end_open_round(target.id);
    else
      null;
  end case;

  update public.rooms
  set status = rule.to_status,
      current_round = new_round,
      game_number = target.game_number + case when room_event = 'play_again' then 1 else 0 end
  where id = target.id
  returning * into result;
  return result;
end;
$$;

-- Ends the live round when every player who was in the room at its start
-- (still in it and connected) has a result, or when the time is up (after
-- the grace for late results). Applies end_round, the transition behind the
-- admin's Skip, on the database's own authority. Callers must hold a lock on
-- the room row.
create function private.end_round_if_over(target_room_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  open_round public.rounds;
  time_limit_ms bigint;
  players_in integer;
  players_waiting integer;
begin
  if (select status from public.rooms where id = target_room_id) <> 'round_live' then
    return;
  end if;
  select * into open_round
  from public.rounds
  where room_id = target_room_id
    and ended_at is null;
  if not found then
    return;
  end if;

  select z.time_limit_seconds * 1000 into time_limit_ms
  from public.puzzles z
  where z.id = open_round.puzzle_id;

  select
    count(*),
    count(*) filter (where not exists (
      select 1 from public.scores s where s.round_id = open_round.id and s.player_id = p.id
    ))
  into players_in, players_waiting
  from public.players p
  where p.room_id = target_room_id
    and p.left_at is null
    and p.connected
    and p.joined_at <= open_round.started_at;

  if (players_in > 0 and players_waiting = 0)
      or private.round_elapsed_ms(open_round, now())
         > time_limit_ms + private.submit_grace_ms() then
    perform private.apply_room_event(target_room_id, 'end_round', 'admin');
  end if;
end;
$$;

-- API: results ---------------------------------------------------------------------

-- Same signature as before. The caller's one result for the live round:
-- passed (solved) or not (gave up), and whether they used the hint. The
-- server measures the solve time from the round's start, without pauses,
-- and computes the points, so the client cannot choose them.
create or replace function public.record_score(round_id uuid, passed boolean, hint_used boolean)
returns public.scores
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_round public.rounds;
  room_status public.room_status;
  puzzle public.puzzles;
  me public.players;
  elapsed_ms bigint;
  result public.scores;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into target_round from public.rounds r where r.id = record_score.round_id;
  if found then
    -- Serialise with admin actions, heartbeats and other results in the room.
    select r.status into room_status
    from public.rooms r
    where r.id = target_round.room_id
    for update;
    -- The lock may have waited for the round to end: read it again.
    select * into target_round from public.rounds r where r.id = record_score.round_id;
    select * into me
    from public.players p
    where p.room_id = target_round.room_id
      and p.user_id = caller
      and p.left_at is null;
  end if;
  -- Same error for "no such round" and "not your room": do not leak rounds.
  if me.id is null then
    raise exception 'round_not_found' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.scores s where s.round_id = target_round.id and s.player_id = me.id
  ) then
    raise exception 'already_submitted' using errcode = 'P0001';
  end if;
  if me.joined_at > target_round.started_at then
    raise exception 'joined_late' using errcode = 'P0001';
  end if;

  select * into puzzle from public.puzzles z where z.id = target_round.puzzle_id;
  elapsed_ms := private.round_elapsed_ms(target_round, now());
  if room_status <> 'round_live'
      or target_round.ended_at is not null
      or target_round.paused_at is not null
      or elapsed_ms > puzzle.time_limit_seconds * 1000 + private.submit_grace_ms() then
    raise exception 'round_not_live' using errcode = 'P0001';
  end if;

  elapsed_ms := least(greatest(elapsed_ms, 0), puzzle.time_limit_seconds * 1000);
  insert into public.scores
    (round_id, player_id, passed, solve_time_ms, hint_used, points, submitted_at)
  values (
    target_round.id,
    me.id,
    coalesce(record_score.passed, false),
    case when record_score.passed then elapsed_ms::integer end,
    coalesce(record_score.hint_used, false),
    case
      when record_score.passed then private.calculate_points(
        puzzle.base_points,
        puzzle.time_limit_seconds,
        elapsed_ms::integer,
        coalesce(record_score.hint_used, false)
      )
      else 0
    end,
    now()
  )
  returning * into result;

  perform private.end_round_if_over(target_round.room_id);
  return result;
end;
$$;

-- API: reading the round -------------------------------------------------------------

-- The room's current round (live, paused or just ended) with its puzzle and
-- the server's clock, so every client counts down from the same numbers:
--   time left = started_at + time limit + paused time - server now
-- No row in the lobby or during a countdown (the round starts with
-- begin_round). Players in the room only.
create function public.get_current_round(target_room_id uuid)
returns table (
  round_id uuid,
  game_number integer,
  round_number integer,
  started_at timestamptz,
  paused_at timestamptz,
  paused_ms integer,
  ended_at timestamptz,
  server_now timestamptz,
  puzzle_id text,
  language public.language_id,
  level public.puzzle_level,
  title text,
  description text,
  buggy_code text,
  tests text,
  hint text,
  time_limit_seconds integer,
  base_points integer,
  -- The caller joined after the round started: they watch, they cannot submit.
  joined_late boolean,
  -- The caller already has a result for this round.
  submitted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me public.players;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select p.* into me
  from public.players p
  join public.rooms r on r.id = p.room_id
  where p.room_id = target_room_id
    and p.user_id = auth.uid()
    and p.left_at is null
    and r.status <> 'closed';
  if me.id is null then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  return query
  select
    rd.id,
    rd.game_number,
    rd.round_number,
    rd.started_at,
    rd.paused_at,
    rd.paused_ms,
    rd.ended_at,
    now(),
    z.id,
    z.language,
    z.level,
    z.title,
    z.description,
    z.buggy_code,
    z.tests,
    z.hint,
    z.time_limit_seconds,
    z.base_points,
    me.joined_at > rd.started_at,
    exists (select 1 from public.scores s where s.round_id = rd.id and s.player_id = me.id)
  from public.rooms r
  join public.rounds rd
    on rd.room_id = r.id
   and rd.game_number = r.game_number
   and rd.round_number = r.current_round
  join public.puzzles z on z.id = rd.puzzle_id
  where r.id = target_room_id
    and r.status in ('round_live', 'paused', 'round_results', 'final_leaderboard');
end;
$$;

-- The puzzle id of an ended round, for the fix reveal. Raises round_not_over
-- while the round is still on, and round_not_found for anyone who was never
-- in the room. Players who left can still see the fix of a round they saw.
create function public.reveal_round_puzzle(target_round_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.rounds;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select rd.* into target
  from public.rounds rd
  where rd.id = target_round_id
    and exists (
      select 1 from public.players p where p.room_id = rd.room_id and p.user_id = auth.uid()
    );
  if not found then
    raise exception 'round_not_found' using errcode = 'P0001';
  end if;
  if target.ended_at is null then
    raise exception 'round_not_over' using errcode = 'P0001';
  end if;
  return target.puzzle_id;
end;
$$;

-- Heartbeat --------------------------------------------------------------------------
-- Same as in 20261008000004, plus the round check: a heartbeat ends a round
-- whose time is up, or whose last waiting player just dropped.

create or replace function public.room_heartbeat(target_room_id uuid)
returns public.room_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.players := private.lock_my_room(target_room_id);
begin
  if private.is_abandoned(target_room_id) then
    return (private.apply_room_event(target_room_id, 'abandon', 'system')).status;
  end if;

  perform private.touch_presence(me.id);
  if not me.connected then
    update public.players set connected = true where id = me.id;
  end if;
  perform private.refresh_connections(target_room_id);
  perform private.hand_over_admin(target_room_id);
  perform private.end_round_if_over(target_room_id);
  return (select status from public.rooms where id = target_room_id);
end;
$$;

-- Privileges -------------------------------------------------------------------------

revoke all on function private.submit_grace_ms() from public, anon, authenticated;
revoke all on function private.ms_between(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function private.round_elapsed_ms(public.rounds, timestamptz)
  from public, anon, authenticated;
revoke all on function private.levels_for_round(public.room_level, integer)
  from public, anon, authenticated;
revoke all on function private.pick_puzzle(public.rooms) from public, anon, authenticated;
revoke all on function private.end_open_round(uuid) from public, anon, authenticated;
revoke all on function private.end_round_if_over(uuid) from public, anon, authenticated;

revoke all on function public.get_current_round(uuid) from public, anon, authenticated;
revoke all on function public.reveal_round_puzzle(uuid) from public, anon, authenticated;
grant execute on function public.get_current_round(uuid) to authenticated;
grant execute on function public.reveal_round_puzzle(uuid) to authenticated;
