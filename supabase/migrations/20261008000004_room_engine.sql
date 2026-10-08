-- Bug Hunt Race: room engine (TB-32).
--
--   * Room state machine: `private.room_transitions` mirrors
--     ROOM_TRANSITIONS in lib/game/room-machine.ts (a unit test keeps them in
--     sync). The admin moves the room with advance_room(); clients can no
--     longer write `rooms.status`, `current_round` or `locked` directly.
--   * Connections: each client calls room_heartbeat() every few seconds. A
--     player not seen for 15 s is marked disconnected; if that is the admin,
--     the earliest-joined connected player becomes admin.
--   * Leaving: leave_room() frees the seat and the name but keeps the row, so
--     scores survive and a returning player gets their score back.
--   * Auto-close: a room nobody has been seen in for 10 minutes is closed the
--     next time anyone looks it up, creates a room or sends a heartbeat.
--   * Max 30 players per room. rooms and players are published to Realtime.
--
-- New error codes: not_room_admin, invalid_transition.

-- Settings ---------------------------------------------------------------------

create or replace function private.max_players_per_room()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 30;
$$;

create function private.disconnect_after()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '15 seconds';
$$;

create function private.abandon_after()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '10 minutes';
$$;

-- Players: leaving -------------------------------------------------------------

alter table public.players add column left_at timestamptz;

comment on column public.players.left_at is
  'Set by leave_room(). A player who left holds no seat or name but keeps their scores.';

alter table public.players
  add constraint players_left_not_connected check (left_at is null or not connected);

-- Names only need to be unique among players still in the room.
drop index public.players_room_name_key;
create unique index players_room_name_key on public.players (room_id, lower(display_name))
  where left_at is null;

create or replace function private.unique_display_name(target_room_id uuid, wanted_name text)
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
      and left_at is null
      and lower(display_name) = lower(candidate)
  ) loop
    suffix := suffix + 1;
    candidate := wanted_name || ' (' || suffix || ')';
  end loop;
  return candidate;
end;
$$;

-- Presence -----------------------------------------------------------------------
-- last_seen_at changes on every heartbeat, so it lives outside `players`:
-- players is published to Realtime and should only change when something
-- visible does (join, leave, connect, disconnect, admin).

create table private.player_presence (
  player_id uuid primary key references public.players (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table private.player_presence enable row level security;
revoke all on table private.player_presence from public, anon, authenticated;

create function private.touch_presence(target_player_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into private.player_presence (player_id, last_seen_at)
  values (target_player_id, now())
  on conflict (player_id) do update set last_seen_at = excluded.last_seen_at;
$$;

-- Marks players not seen for 15 s as disconnected. Players from before this
-- migration have no presence row; their join time counts as last seen.
create function private.refresh_connections(target_room_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.players p
  set connected = false
  where p.room_id = target_room_id
    and p.connected
    and coalesce(
      (select pp.last_seen_at from private.player_presence pp where pp.player_id = p.id),
      p.joined_at
    ) < now() - private.disconnect_after();
$$;

-- Admin hand-over. Callers must hold a lock on the room row. If the admin is
-- not connected (or left), the earliest-joined connected player takes over.
-- With nobody connected, a disconnected admin keeps the role; one who left
-- loses it, and the next player to connect becomes admin.
create function private.hand_over_admin(target_room_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  admin public.players;
  successor uuid;
begin
  select p.* into admin
  from public.rooms r
  join public.players p on p.id = r.admin_player_id
  where r.id = target_room_id;

  if admin.id is not null and admin.connected then
    return;
  end if;

  select p.id into successor
  from public.players p
  where p.room_id = target_room_id
    and p.connected
  order by p.joined_at, p.id
  limit 1;

  if successor is null and admin.id is not null and admin.left_at is null then
    return;
  end if;

  update public.rooms
  set admin_player_id = successor
  where id = target_room_id
    and admin_player_id is distinct from successor;
end;
$$;

-- State machine ------------------------------------------------------------------

create type public.room_event as enum (
  'start',
  'begin_round',
  'pause',
  'resume',
  'end_round',
  'next_round',
  'finish',
  'stop',
  'play_again',
  'close',
  'abandon'
);

create table private.room_transitions (
  from_status public.room_status not null,
  event public.room_event not null,
  to_status public.room_status not null,
  -- admin: advance_room(). system: only this database (auto-close).
  actor text not null check (actor in ('admin', 'system')),
  primary key (from_status, event)
);

alter table private.room_transitions enable row level security;
revoke all on table private.room_transitions from public, anon, authenticated;

-- Keep in sync with ROOM_TRANSITIONS in lib/game/room-machine.ts.
insert into private.room_transitions (from_status, event, to_status, actor) values
  ('lobby', 'start', 'countdown', 'admin'),
  ('countdown', 'begin_round', 'round_live', 'admin'),
  ('round_live', 'pause', 'paused', 'admin'),
  ('paused', 'resume', 'round_live', 'admin'),
  ('round_live', 'end_round', 'round_results', 'admin'),
  ('round_results', 'next_round', 'countdown', 'admin'),
  ('round_results', 'finish', 'final_leaderboard', 'admin'),
  ('round_live', 'stop', 'final_leaderboard', 'admin'),
  ('paused', 'stop', 'final_leaderboard', 'admin'),
  ('final_leaderboard', 'play_again', 'lobby', 'admin'),
  ('final_leaderboard', 'close', 'closed', 'admin'),
  ('lobby', 'abandon', 'closed', 'system'),
  ('countdown', 'abandon', 'closed', 'system'),
  ('round_live', 'abandon', 'closed', 'system'),
  ('paused', 'abandon', 'closed', 'system'),
  ('round_results', 'abandon', 'closed', 'system'),
  ('final_leaderboard', 'abandon', 'closed', 'system');

-- Applies one event, or raises invalid_transition. Same rules as transition()
-- in lib/game/room-machine.ts: next_round needs a round left, finish needs
-- the last round played (or "until stopped").
create function private.apply_room_event(
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

  update public.rooms
  set status = rule.to_status,
      current_round = new_round
  where id = target.id
  returning * into result;
  return result;
end;
$$;

-- Auto-close ---------------------------------------------------------------------

-- Nobody has been seen in the room for 10 minutes (an empty room counts from
-- its creation).
create function private.is_abandoned(target_room_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(max(coalesce(pp.last_seen_at, p.joined_at)), r.created_at)
           < now() - private.abandon_after()
  from public.rooms r
  left join public.players p on p.room_id = r.id
  left join private.player_presence pp on pp.player_id = p.id
  where r.id = target_room_id
  group by r.id;
$$;

-- Closes every abandoned room. Locks in id order and skips rooms another
-- transaction holds (someone is active there), so callers never wait.
create function private.close_abandoned_rooms()
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  abandoned_id uuid;
begin
  for abandoned_id in
    select r.id
    from public.rooms r
    where r.status <> 'closed'
      and private.is_abandoned(r.id)
    order by r.id
    for update skip locked
  loop
    perform private.apply_room_event(abandoned_id, 'abandon', 'system');
  end loop;
end;
$$;

-- API: lookup, create, join -------------------------------------------------------
-- Same signatures as before; now they close abandoned rooms first, count only
-- players still in the room, and record presence.

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
end;
$$;

create or replace function public.create_room(
  room_language public.language_id,
  room_level public.room_level,
  display_name text,
  avatar text,
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

  -- Frees the codes of abandoned rooms.
  perform private.close_abandoned_rooms();

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
  perform private.touch_presence(admin_player.id);

  update public.rooms set admin_player_id = admin_player.id where id = new_room.id;

  select * into admin_player from public.players where id = admin_player.id;
  return admin_player;
end;
$$;

-- Rejoin (same browser = same anonymous user) returns the existing player,
-- even when the room is locked or full. A player who left comes back like a
-- new player (lock, cap and name rules apply) but keeps their scores.
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
  -- A room whose admin left with nobody else around has no admin.
  perform private.hand_over_admin(target_room.id);

  select * into joined from public.players where id = joined.id;
  return joined;
end;
$$;

-- API: room actions --------------------------------------------------------------

-- Locks the open room the caller is in and returns the caller's player, or
-- raises room_not_found. Same error for "no such room" and "not your room".
create function private.lock_my_room(target_room_id uuid)
returns public.players
language plpgsql
volatile
set search_path = ''
as $$
declare
  me public.players;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform 1
  from public.rooms
  where id = target_room_id
    and status <> 'closed'
  for update;
  if found then
    select * into me
    from public.players
    where room_id = target_room_id
      and user_id = auth.uid()
      and left_at is null;
  end if;
  if me.id is null then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;
  return me;
end;
$$;

-- Call every few seconds while in a room (lib/rooms does this). Records the
-- caller as connected, marks players not seen for 15 s as disconnected and
-- hands the admin role over if needed. Returns the room status: 'closed' if
-- the room had been abandoned (it is closed now).
create function public.room_heartbeat(target_room_id uuid)
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
  return (select status from public.rooms where id = target_room_id);
end;
$$;

-- The caller leaves the room. If they were the admin, the role passes on now.
create function public.leave_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.players := private.lock_my_room(target_room_id);
begin
  update public.players set left_at = now(), connected = false where id = me.id;
  perform private.hand_over_admin(target_room_id);
end;
$$;

-- Admin only: moves the room through the state machine.
create function public.advance_room(target_room_id uuid, room_event public.room_event)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.players := private.lock_my_room(target_room_id);
begin
  if not me.is_admin then
    raise exception 'not_room_admin' using errcode = 'P0001';
  end if;
  return private.apply_room_event(target_room_id, room_event, 'admin');
end;
$$;

-- Admin only: lock or unlock the room to new players.
create function public.set_room_locked(target_room_id uuid, room_locked boolean)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.players := private.lock_my_room(target_room_id);
  result public.rooms;
begin
  if not me.is_admin then
    raise exception 'not_room_admin' using errcode = 'P0001';
  end if;
  update public.rooms
  set locked = coalesce(room_locked, false)
  where id = target_room_id
  returning * into result;
  return result;
end;
$$;

-- Privileges -----------------------------------------------------------------------

-- Status, round and lock now change only through the functions above, and
-- connection flags only through heartbeats.
revoke update (status, current_round, locked) on table public.rooms from authenticated;
revoke update (connected) on table public.players from authenticated;
drop policy "Players can update their own connection flag" on public.players;

revoke all on function private.disconnect_after() from public, anon, authenticated;
revoke all on function private.abandon_after() from public, anon, authenticated;
revoke all on function private.touch_presence(uuid) from public, anon, authenticated;
revoke all on function private.refresh_connections(uuid) from public, anon, authenticated;
revoke all on function private.hand_over_admin(uuid) from public, anon, authenticated;
revoke all on function private.apply_room_event(uuid, public.room_event, text)
  from public, anon, authenticated;
revoke all on function private.is_abandoned(uuid) from public, anon, authenticated;
revoke all on function private.close_abandoned_rooms() from public, anon, authenticated;
revoke all on function private.lock_my_room(uuid) from public, anon, authenticated;

revoke all on function public.room_heartbeat(uuid) from public, anon, authenticated;
revoke all on function public.leave_room(uuid) from public, anon, authenticated;
revoke all on function public.advance_room(uuid, public.room_event) from public, anon, authenticated;
revoke all on function public.set_room_locked(uuid, boolean) from public, anon, authenticated;

grant execute on function public.room_heartbeat(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.advance_room(uuid, public.room_event) to authenticated;
grant execute on function public.set_room_locked(uuid, boolean) to authenticated;

-- Realtime ----------------------------------------------------------------------
-- Subscribers only receive rows their RLS policies let them read, i.e. their
-- own room. Rows are never deleted through the API, so no DELETE events leak.

alter publication supabase_realtime add table public.rooms, public.players;
