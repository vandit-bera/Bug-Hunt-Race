-- Bug Hunt Race: row-level security and table privileges (TB-23).
--
-- Every player signs in with Supabase anonymous auth, so auth.uid() identifies
-- them. The rules:
--   * You can read a room, its players, rounds and scores only if you are a
--     player in that room.
--   * Only the room's admin can change the room (status, settings, lock).
--   * Players can only flip their own `connected` flag.
--   * Nobody writes players, rounds or scores directly: create_room(),
--     join_room() and record_score() do it (next migration).
--   * Puzzles are read-only for everyone. They never include the reference fix.

-- Helpers in a schema the Data API does not expose --------------------------

create schema if not exists private;
grant usage on schema private to authenticated;

-- security definer so the lookup itself is not filtered by players' RLS
-- (which would recurse).
create function private.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.players
    where room_id = target_room_id
      and user_id = (select auth.uid())
  );
$$;

create function private.is_room_admin(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms r
    join public.players p on p.id = r.admin_player_id
    where r.id = target_room_id
      and p.user_id = (select auth.uid())
  );
$$;

create function private.is_round_member(target_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rounds r
    join public.players p on p.room_id = r.room_id
    where r.id = target_round_id
      and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_room_member(uuid) from public;
revoke all on function private.is_room_admin(uuid) from public;
revoke all on function private.is_round_member(uuid) from public;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.is_room_admin(uuid) to authenticated;
grant execute on function private.is_round_member(uuid) to authenticated;

-- Start from zero: Supabase grants everything on new public tables to the
-- API roles by default. Grant back only what each role needs.

revoke all on table public.rooms, public.players, public.puzzles, public.rounds, public.scores
  from anon, authenticated;

-- Rooms --------------------------------------------------------------------

alter table public.rooms enable row level security;

grant select on table public.rooms to authenticated;
-- Column list = what the admin may change. Not id, code, admin_player_id or
-- timestamps.
grant update (status, language, level, total_rounds, locked, current_round)
  on table public.rooms to authenticated;

create policy "Room members can read their room"
  on public.rooms for select
  to authenticated
  using (private.is_room_member(id));

create policy "Only the room admin can update the room"
  on public.rooms for update
  to authenticated
  using (private.is_room_admin(id))
  with check (private.is_room_admin(id));

-- Players ------------------------------------------------------------------

alter table public.players enable row level security;

grant select on table public.players to authenticated;
grant update (connected) on table public.players to authenticated;

create policy "Room members can read players in their room"
  on public.players for select
  to authenticated
  using (private.is_room_member(room_id));

create policy "Players can update their own connection flag"
  on public.players for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Puzzles ------------------------------------------------------------------

alter table public.puzzles enable row level security;

grant select on table public.puzzles to anon, authenticated;

-- Puzzles are public content (the source is in the public repo); only the
-- reference fix is secret, and it is not in this table.
create policy "Anyone can read puzzles"
  on public.puzzles for select
  to anon, authenticated
  using (true);

-- Rounds -------------------------------------------------------------------

alter table public.rounds enable row level security;

grant select on table public.rounds to authenticated;

create policy "Room members can read rounds in their room"
  on public.rounds for select
  to authenticated
  using (private.is_room_member(room_id));

-- Scores -------------------------------------------------------------------

alter table public.scores enable row level security;

grant select on table public.scores to authenticated;

create policy "Room members can read scores in their room"
  on public.scores for select
  to authenticated
  using (private.is_round_member(round_id));
