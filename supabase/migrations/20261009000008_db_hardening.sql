-- DB hardening (TB-66), findings L1–L3 of docs/SECURITY_REVIEW.md.
--
--   * L1: room settings (language, level, total_rounds) only change in the
--     lobby. The admin keeps the column grants, but a trigger refuses the
--     change once the game has started.
--   * L2: room_heartbeat checks the caller is in the room before it takes the
--     room row lock, so an outsider cannot make the room row contend.
--   * L3: the room's Realtime channel is private: only players still in the
--     room may join it, so an outsider cannot show anyone as online.
--
-- Rollback (in one transaction):
--   drop trigger rooms_settings_lobby_only on public.rooms;
--   drop function private.guard_room_settings();
--   drop policy "Room players can read the room channel" on realtime.messages;
--   drop policy "Room players can track presence on the room channel" on realtime.messages;
--   drop function private.can_use_room_channel();
--   then re-run the room_heartbeat definition from 20261009000007_end_of_game.sql,
--   and ship the client with `private: true` removed from lib/rooms/connection.ts
--   first (a private channel with no policy refuses every join).

-- L1: settings are lobby-only ----------------------------------------------------

create function private.guard_room_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'lobby'
    and (new.language, new.level, new.total_rounds)
      is distinct from (old.language, old.level, old.total_rounds) then
    raise exception 'room_settings_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger rooms_settings_lobby_only
  before update of language, level, total_rounds on public.rooms
  for each row
  execute function private.guard_room_settings();

revoke all on function private.guard_room_settings() from public, anon, authenticated;

-- L2: membership before the lock ---------------------------------------------------

-- Same as in 20261009000007, except that the membership check comes first and
-- takes no lock: someone who is not in the room gets room_not_found without
-- touching the room row.
create or replace function public.room_heartbeat(target_room_id uuid)
returns public.room_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.players;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.players
    where room_id = target_room_id
      and user_id = auth.uid()
      and left_at is null
  ) then
    raise exception 'room_not_found' using errcode = 'P0001';
  end if;

  -- Wait for any action in progress (e.g. Close) before reading the status.
  perform 1 from public.rooms where id = target_room_id for update;
  if (select status from public.rooms where id = target_room_id) = 'closed' then
    return 'closed';
  end if;

  -- Re-checks membership under the lock (the player may have just left).
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

-- room_heartbeat keeps its grants (same signature).

-- L3: private room channel ------------------------------------------------------------

-- True if the caller is still in the room whose channel (`room:<id>`,
-- lib/rooms/connection.ts) Realtime is authorizing. Realtime sets
-- realtime.topic() when a client joins a private channel.
create function private.can_use_room_channel()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.players p
    where p.user_id = (select auth.uid())
      and p.left_at is null
      and 'room:' || p.room_id::text = (select realtime.topic())
  );
$$;

revoke all on function private.can_use_room_channel() from public, anon;
grant execute on function private.can_use_room_channel() to authenticated;

-- Realtime checks these when a client joins a private channel: select to
-- receive presence, insert to track it. Database changes on the channel stay
-- filtered by the tables' own RLS. Broadcast is not used, so nobody may send
-- it.
create policy "Room players can read the room channel"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('presence', 'broadcast')
    and (select private.can_use_room_channel())
  );

create policy "Room players can track presence on the room channel"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (select private.can_use_room_channel())
  );
