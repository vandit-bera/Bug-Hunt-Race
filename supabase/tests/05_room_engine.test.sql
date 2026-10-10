-- Room engine (TB-32): state machine, admin-only actions, heartbeats and
-- admin hand-over, leaving and rejoining, 30-player cap, auto-close.
begin;
select plan(47);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- Ana: creates the room
  ('00000000-0000-0000-0000-0000000000b1'),  -- Ben
  ('00000000-0000-0000-0000-0000000000c1'),  -- Cleo
  ('00000000-0000-0000-0000-0000000000e1'),  -- Eve: arrives when the room is full
  ('00000000-0000-0000-0000-0000000000f1');  -- Finn: in no room

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into ids select 'ana', id from public.create_room('javascript', 'easy', 'Ana', '🦊', 3);
insert into ids select 'room', room_id from public.players where id = (select id from ids where name = 'ana');
create temp table room_code as
  select code from public.rooms where id = (select id from ids where name = 'room');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
insert into ids select 'ben', id from public.join_room((select code from room_code), 'Ben', '🐼');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into ids select 'cleo', id from public.join_room((select code from room_code), 'Cleo', '🐙');
reset role;

-- Everyone joined in this transaction; spread the join times so "earliest
-- joined" is well defined.
update public.players set joined_at = now() - interval '3 minutes' where id = (select id from ids where name = 'ana');
update public.players set joined_at = now() - interval '2 minutes' where id = (select id from ids where name = 'ben');
update public.players set joined_at = now() - interval '1 minute' where id = (select id from ids where name = 'cleo');
grant select on room_code to anon, authenticated;

-- Admin-only actions ----------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'start')$$,
  'P0001', 'not_room_admin', 'a non-admin cannot start the game'
);
select throws_ok(
  $$select public.set_room_locked((select id from ids where name = 'room'), true)$$,
  'P0001', 'not_room_admin', 'a non-admin cannot lock the room'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'start')$$,
  'P0001', 'room_not_found', 'an outsider gets room_not_found, not a hint that the room exists'
);
select throws_ok(
  $$select public.room_heartbeat((select id from ids where name = 'room'))$$,
  'P0001', 'room_not_found', 'an outsider cannot send heartbeats to the room'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'abandon')$$,
  'P0001', 'invalid_transition', 'abandon is for the database only, not even the admin'
);
select is(
  (select locked from public.set_room_locked((select id from ids where name = 'room'), true)),
  true, 'the admin can lock the room'
);
select is(
  (select locked from public.set_room_locked((select id from ids where name = 'room'), false)),
  false, 'the admin can unlock the room'
);
reset role;

select is(
  (select is_admin from public.players where id = (select id from ids where name = 'ben')),
  false, 'Ben is still not admin'
);

-- Every (state, event) pair ---------------------------------------------------
-- With total_rounds = null and current_round = 1 no guard applies, so the
-- outcome is decided by the transition table alone.

create temp table outcomes (from_status text, event text, outcome text);
grant insert on outcomes to authenticated;

do $$
declare
  s public.room_status;
  e public.room_event;
  result text;
begin
  foreach s in array enum_range(null::public.room_status) loop
    foreach e in array enum_range(null::public.room_event) loop
      update public.rooms
      set status = s, current_round = 1, total_rounds = null
      where id = (select id from ids where name = 'room');
      execute 'set local role authenticated';
      perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
      begin
        select status::text into result
        from public.advance_room((select id from ids where name = 'room'), e);
      exception when others then
        result := sqlerrm;
      end;
      insert into outcomes values (s::text, e::text, result);
      execute 'reset role';
    end loop;
  end loop;
end;
$$;

select results_eq(
  $$select from_status, event, outcome from outcomes
    where outcome not in ('invalid_transition', 'room_not_found')
    order by from_status, event$$,
  $$values
    ('countdown', 'begin_round', 'round_live'),
    ('final_leaderboard', 'close', 'closed'),
    ('final_leaderboard', 'play_again', 'lobby'),
    ('lobby', 'start', 'countdown'),
    ('paused', 'resume', 'round_live'),
    ('paused', 'stop', 'final_leaderboard'),
    ('round_live', 'end_round', 'round_results'),
    ('round_live', 'pause', 'paused'),
    ('round_live', 'stop', 'final_leaderboard'),
    ('round_results', 'finish', 'final_leaderboard'),
    ('round_results', 'next_round', 'countdown')$$,
  'the admin can make exactly the transitions of TB-19 section 12'
);
select is(
  (select count(*) from outcomes where outcome = 'invalid_transition'),
  (6 * 11 - 11)::bigint,
  'every other event from an open state is rejected as invalid_transition'
);
select is(
  (select count(*) from outcomes where from_status = 'closed' and outcome = 'room_not_found'),
  11::bigint,
  'a closed room accepts no events'
);

-- Round guards ----------------------------------------------------------------

-- Back to the lobby first: settings only change there (TB-66).
update public.rooms set status = 'lobby', current_round = 0
where id = (select id from ids where name = 'room');
update public.rooms set total_rounds = 2
where id = (select id from ids where name = 'room');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(
  (select current_round from public.advance_room((select id from ids where name = 'room'), 'start')),
  1, 'start begins round 1'
);
select public.advance_room((select id from ids where name = 'room'), 'begin_round');
select public.advance_room((select id from ids where name = 'room'), 'end_round');
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'finish')$$,
  'P0001', 'invalid_transition', 'finish needs the last round played'
);
select is(
  (select current_round from public.advance_room((select id from ids where name = 'room'), 'next_round')),
  2, 'next_round moves to round 2'
);
select public.advance_room((select id from ids where name = 'room'), 'begin_round');
select public.advance_room((select id from ids where name = 'room'), 'end_round');
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'next_round')$$,
  'P0001', 'invalid_transition', 'no next_round after the last round'
);
select is(
  (select status::text from public.advance_room((select id from ids where name = 'room'), 'finish')),
  'final_leaderboard', 'finish after the last round shows the final leaderboard'
);
select results_eq(
  $$select status::text, current_round from public.advance_room((select id from ids where name = 'room'), 'play_again')$$,
  $$values ('lobby', 0)$$,
  'play again returns to the lobby and resets the round'
);
reset role;

-- Heartbeats and admin hand-over ---------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  public.room_heartbeat((select id from ids where name = 'room'))::text,
  'lobby', 'a heartbeat returns the room status'
);
reset role;

-- Ana's last heartbeat was 14 s ago: still connected, still admin.
update private.player_presence set last_seen_at = now() - interval '14 seconds'
where player_id = (select id from ids where name = 'ana');
set local role authenticated;
select public.room_heartbeat((select id from ids where name = 'room'));
reset role;
select results_eq(
  $$select connected, is_admin from public.players where id = (select id from ids where name = 'ana')$$,
  $$values (true, true)$$,
  'an admin silent for 14 s keeps the role'
);

-- 16 s: disconnected, and the earliest-joined connected player (Ben) takes over.
update private.player_presence set last_seen_at = now() - interval '16 seconds'
where player_id = (select id from ids where name = 'ana');
set local role authenticated;
select public.room_heartbeat((select id from ids where name = 'room'));
reset role;
select results_eq(
  $$select connected, is_admin from public.players where id = (select id from ids where name = 'ana')$$,
  $$values (false, false)$$,
  'an admin silent for more than 15 s is disconnected and loses the role'
);
select is(
  (select admin_player_id from public.rooms where id = (select id from ids where name = 'room')),
  (select id from ids where name = 'ben'),
  'the earliest-joined connected player becomes admin'
);

set local role authenticated;
select lives_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'start')$$,
  'the new admin can start the game'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'begin_round')$$,
  'P0001', 'not_room_admin', 'the old admin cannot act any more'
);

-- Reconnect: Ana comes back from the same browser (same user).
select is(
  (select id from public.join_room((select code from room_code), 'Somebody', '🐸')),
  (select id from ids where name = 'ana'),
  'reconnecting returns the same player'
);
select is(
  public.room_heartbeat((select id from ids where name = 'room'))::text,
  'countdown', 'the reconnected player''s heartbeats are accepted'
);
reset role;
select results_eq(
  $$select display_name, connected, is_admin from public.players where id = (select id from ids where name = 'ana')$$,
  $$values ('Ana', true, false)$$,
  'a reconnected player keeps their name and does not take the admin role back'
);

-- Leaving --------------------------------------------------------------------------

-- Give Ben a score to check it survives leaving and coming back.
insert into public.rounds (id, room_id, puzzle_id, game_number, round_number)
select '00000000-0000-0000-0000-00000000ea01', id, 'average-rating', game_number, 1
from public.rooms where id = (select id from ids where name = 'room');
insert into public.scores (round_id, player_id, passed, solve_time_ms, points)
values ('00000000-0000-0000-0000-00000000ea01', (select id from ids where name = 'ben'), true, 30000, 150);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok(
  $$select public.leave_room((select id from ids where name = 'room'))$$,
  'the admin can leave'
);
reset role;
select is(
  (select admin_player_id from public.rooms where id = (select id from ids where name = 'room')),
  (select id from ids where name = 'ana'),
  'when the admin leaves, the earliest-joined connected player takes over at once'
);
select results_eq(
  $$select connected, left_at is not null from public.players where id = (select id from ids where name = 'ben')$$,
  $$values (false, true)$$,
  'a player who left is marked left and disconnected'
);

set local role authenticated;
select throws_ok(
  $$select public.room_heartbeat((select id from ids where name = 'room'))$$,
  'P0001', 'room_not_found', 'a player who left sends no more heartbeats'
);
select throws_ok(
  $$select public.leave_room((select id from ids where name = 'room'))$$,
  'P0001', 'room_not_found', 'leaving twice is rejected'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  (select id from public.join_room((select code from room_code), 'Ben', '🐼')),
  (select id from ids where name = 'ben'),
  'a player who left and comes back gets their old player back'
);
reset role;
select is(
  (select total_points from public.room_leaderboard where player_id = (select id from ids where name = 'ben')),
  150, 'and keeps their score'
);

-- 30-player cap -------------------------------------------------------------------

insert into auth.users (id)
select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 27) i;
insert into public.players (room_id, user_id, display_name, avatar)
select (select id from ids where name = 'room'),
       ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
       'Filler ' || i, '🤖'
from generate_series(1, 27) i;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$select public.join_room((select code from room_code), 'Eve', '🦉')$$,
  'P0001', 'room_full', 'the 31st player is rejected: room_full'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0001-000000000001","role":"authenticated"}', true);
select public.leave_room((select id from ids where name = 'room'));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is(
  (select display_name from public.join_room((select code from room_code), 'Filler 1', '🦉')),
  'Filler 1',
  'a player who left frees their seat and their name'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0001-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select public.join_room((select code from room_code), 'Filler 1', '🤖')$$,
  'P0001', 'room_full', 'coming back after leaving needs a free seat'
);
reset role;

-- Auto-close ----------------------------------------------------------------------

update public.rooms set created_at = now() - interval '1 hour'
where id = (select id from ids where name = 'room');
update private.player_presence set last_seen_at = now() - interval '9 minutes'
where player_id in (select id from public.players where room_id = (select id from ids where name = 'room'));
update public.players set joined_at = now() - interval '20 minutes'
where room_id = (select id from ids where name = 'room');

set local role anon;
select results_eq(
  $$select player_count from public.find_open_room((select code from room_code))$$,
  $$values (30)$$,
  'a room last seen 9 minutes ago is still open'
);
reset role;

update private.player_presence set last_seen_at = now() - interval '11 minutes'
where player_id in (select id from public.players where room_id = (select id from ids where name = 'room'));

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(
  public.room_heartbeat((select id from ids where name = 'room'))::text,
  'closed',
  'the first heartbeat after 10 minutes of nobody closes the room'
);
reset role;

set local role anon;
select results_eq(
  $$select status::text from public.find_open_room((select code from room_code))$$,
  $$values ('closed')$$,
  'an auto-closed room''s code reports closed'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select public.join_room((select code from room_code), 'Cleo', '🐙')$$,
  'P0001', 'room_closed', 'an auto-closed room cannot be joined, not even by a member'
);
reset role;

-- A second room, abandoned with nobody touching it, is closed by any lookup.
insert into public.rooms (id, code, language, level, created_at)
values ('00000000-0000-0000-0000-00000000dddd', 'DDDDDD', 'python', 'easy', now() - interval '11 minutes');
set local role anon;
select results_eq(
  $$select status::text from public.find_open_room('DDDDDD')$$,
  $$values ('closed')$$,
  'an empty room older than 10 minutes is closed on lookup'
);
reset role;
select is(
  (select status::text from public.rooms where code = 'DDDDDD'),
  'closed', 'and stays closed'
);

-- Privileges and Realtime ---------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.advance_room('00000000-0000-0000-0000-00000000dddd', 'start')$$,
  '42501', null, 'signed-out visitors cannot call room actions'
);
select throws_ok(
  $$select public.room_heartbeat('00000000-0000-0000-0000-00000000dddd')$$,
  '42501', null, 'signed-out visitors cannot send heartbeats'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select * from private.player_presence$$,
  '42501', null, 'presence is private'
);
select throws_ok(
  $$select private.close_abandoned_rooms()$$,
  '42501', null, 'auto-close is not callable from the API'
);
reset role;

select results_eq(
  $$select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename in ('players', 'rooms')$$,
  $$values (2::bigint)$$,
  'rooms and players are published to Realtime'
);

select * from finish();
rollback;
