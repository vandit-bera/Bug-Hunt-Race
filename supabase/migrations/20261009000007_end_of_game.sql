-- Bug Hunt Race: end of game (TB-59).
--
-- Play again and Close room are already admin-only room events (TB-32), and
-- Play again already starts a new game (rooms.game_number, TB-53). This adds:
--   * Leaderboard per game: room_leaderboard counts only the room's current
--     game, so a new game starts at 0. Older games' scores stay stored.
--     Rank: total points, then the earlier server time of the last solve;
--     exact ties share the place. previous_rank (the rank before the latest
--     round) gives the round results screen its up/down arrows.
--   * Room closed: a code or link of a closed room now says so instead of
--     "not found". find_open_room returns the room with status 'closed',
--     join_room raises room_closed, and a heartbeat from a player still in a
--     closed room returns 'closed' instead of raising.
--
-- New error code: room_closed.

-- Leaderboard --------------------------------------------------------------------
-- Same columns as in 20261008000003, plus game_number, last_solved_at and
-- previous_rank at the end, so grants and existing readers are unchanged.

create or replace view public.room_leaderboard
with (security_invoker = true)
as
with game_results as (
  -- Results from each room's current game, flagged when they belong to its
  -- latest round.
  select
    s.player_id,
    s.points,
    s.passed,
    s.solve_time_ms,
    s.submitted_at,
    rd.round_number = (
      select max(latest.round_number)
      from public.rounds latest
      where latest.room_id = rd.room_id
        and latest.game_number = rd.game_number
    ) as in_latest_round
  from public.scores s
  join public.rounds rd on rd.id = s.round_id
  join public.rooms r on r.id = rd.room_id and r.game_number = rd.game_number
),
totals as (
  select
    p.room_id,
    p.id as player_id,
    p.display_name,
    p.avatar,
    p.is_admin,
    p.connected,
    r.game_number,
    -- null before the game's first round starts.
    (
      select max(rd.round_number)
      from public.rounds rd
      where rd.room_id = r.id
        and rd.game_number = r.game_number
    ) as latest_round,
    coalesce(sum(x.points), 0)::integer as total_points,
    (count(*) filter (where x.passed))::integer as rounds_solved,
    coalesce(sum(x.solve_time_ms), 0)::integer as total_solve_ms,
    max(x.submitted_at) filter (where x.passed) as last_solved_at,
    coalesce(sum(x.points) filter (where not x.in_latest_round), 0) as previous_points,
    max(x.submitted_at) filter (where x.passed and not x.in_latest_round)
      as previous_last_solved_at
  from public.players p
  join public.rooms r on r.id = p.room_id
  left join game_results x on x.player_id = p.id
  group by p.id, r.id
  -- A player who left is listed only if they have a result in this game.
  having p.left_at is null or count(x.player_id) > 0
)
select
  room_id,
  player_id,
  display_name,
  avatar,
  is_admin,
  connected,
  total_points,
  rounds_solved,
  total_solve_ms,
  -- Players with no points have no last solve: they all share the last place.
  (rank() over (
    partition by room_id
    order by total_points desc, last_solved_at asc nulls last
  ))::integer as rank,
  game_number,
  last_solved_at,
  -- null until the game's second round: there is no earlier rank to compare.
  case when latest_round > 1 then
    (rank() over (
      partition by room_id
      order by previous_points desc, previous_last_solved_at asc nulls last
    ))::integer
  end as previous_rank
from totals;

comment on view public.room_leaderboard is
  'Standings in each room''s current game. Rank: points, then earlier last solve (server time); exact ties share the place.';

-- Room closed ----------------------------------------------------------------------

-- The most recently closed room with this code, if no open room has it.
create index rooms_closed_code_idx on public.rooms (code, closed_at desc)
  where status = 'closed';

create function private.is_closed_code(room_code text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms r
    where r.code = upper(btrim(room_code))
      and r.status = 'closed'
  );
$$;

-- Same signature as in 20261008000004. When no open room has the code but a
-- closed one does, returns that room with status 'closed' (unlocked, not
-- full, 0 players) so the join screen can say "Room closed".
create or replace function public.find_open_room(room_code text)
returns table (
  code text,
  status public.room_status,
  locked boolean,
  is_full boolean,
  language public.language_id,
  level public.room_level,
  player_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.close_abandoned_rooms();
  return query
  select
    r.code,
    r.status,
    r.locked,
    count(p.id) >= private.max_players_per_room(),
    r.language,
    r.level,
    count(p.id)::integer
  from public.rooms r
  left join public.players p on p.room_id = r.id and p.left_at is null
  where r.code = upper(btrim(room_code))
    and r.status <> 'closed'
  group by r.id;
  if found then
    return;
  end if;

  return query
  select r.code, r.status, false, false, r.language, r.level, 0
  from public.rooms r
  where r.code = upper(btrim(room_code))
    and r.status = 'closed'
  order by r.closed_at desc
  limit 1;
end;
$$;

-- Same as in 20261008000004, except a closed room raises room_closed.
create or replace function public.join_room(room_code text, display_name text, avatar text)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_room public.rooms;
  existing public.players;
  clean_name text;
  clean_avatar text;
  joined public.players;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform private.close_abandoned_rooms();

  select * into target_room
  from public.rooms
  where code = upper(btrim(room_code))
    and status <> 'closed'
  for update;
  if not found then
    if private.is_closed_code(room_code) then
      raise exception 'room_closed' using errcode = 'P0001';
    end if;
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  select * into existing
  from public.players
  where room_id = target_room.id
    and user_id = caller;

  if existing.id is not null and existing.left_at is null then
    update public.players set connected = true where id = existing.id returning * into joined;
  else
    if target_room.locked then
      raise exception 'room_locked' using errcode = 'P0001';
    end if;
    if (select count(*) from public.players where room_id = target_room.id and left_at is null)
        >= private.max_players_per_room() then
      raise exception 'room_full' using errcode = 'P0001';
    end if;
    clean_name := private.unique_display_name(
      target_room.id,
      private.clean_display_name(display_name)
    );
    clean_avatar := private.check_avatar(avatar);

    if existing.id is not null then
      update public.players
      set left_at = null,
          connected = true,
          display_name = clean_name,
          avatar = clean_avatar
      where id = existing.id
      returning * into joined;
    else
      insert into public.players (room_id, user_id, display_name, avatar)
      values (target_room.id, caller, clean_name, clean_avatar)
      returning * into joined;
    end if;
  end if;

  perform private.touch_presence(joined.id);
  perform private.hand_over_admin(target_room.id);

  select * into joined from public.players where id = joined.id;
  return joined;
end;
$$;

-- Same as in 20261008000006, except that a player still in a room that has
-- closed (admin Close, or abandoned) gets 'closed' back instead of
-- room_not_found, so every client shows "Room closed".
create or replace function public.room_heartbeat(target_room_id uuid)
returns public.room_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.players;
begin
  -- Wait for any action in progress (e.g. Close) before reading the status.
  perform 1 from public.rooms where id = target_room_id for update;
  if exists (
    select 1
    from public.rooms r
    join public.players p on p.room_id = r.id
    where r.id = target_room_id
      and r.status = 'closed'
      and p.user_id = auth.uid()
      and p.left_at is null
  ) then
    return 'closed';
  end if;

  me := private.lock_my_room(target_room_id);
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
-- find_open_room, join_room and room_heartbeat keep their grants (same
-- signatures).

revoke all on function private.is_closed_code(text) from public, anon, authenticated;
