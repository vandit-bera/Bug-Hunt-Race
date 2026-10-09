-- Row-level security: players only see their own room; only the admin
-- changes the room; nobody writes tables the API functions own.
begin;
select plan(35);

-- Fixtures (as postgres) ------------------------------------------------------
-- Room A: Ana (admin) + Ben.  Room C: Cleo (admin).  Xavi: in no room.

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000f1');

insert into public.rooms (id, code, language, level) values
  ('00000000-0000-0000-0000-00000000aaaa', 'AAAAAA', 'javascript', 'easy'),
  ('00000000-0000-0000-0000-00000000cccc', 'CCCCCC', 'python', 'hard');

insert into public.players (id, room_id, user_id, display_name, avatar) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'Ana', '🦊'),
  ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000b1', 'Ben', '🐼'),
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-00000000cccc', '00000000-0000-0000-0000-0000000000c1', 'Cleo', '🐙');

update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001a1'
where id = '00000000-0000-0000-0000-00000000aaaa';
update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001c1'
where id = '00000000-0000-0000-0000-00000000cccc';

insert into public.rounds (id, room_id, puzzle_id, round_number) values
  ('00000000-0000-0000-0000-00000000ea01', '00000000-0000-0000-0000-00000000aaaa', 'average-rating', 1),
  ('00000000-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-00000000cccc', 'merge-intervals', 1);

insert into public.scores (round_id, player_id, passed, solve_time_ms, points) values
  ('00000000-0000-0000-0000-00000000ea01', '00000000-0000-0000-0000-0000000001b1', true, 30000, 150),
  ('00000000-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-0000000001c1', true, 90000, 400);

-- A player in another room (Cleo) sees nothing of room A ----------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

select results_eq($$select code from public.rooms$$, array['CCCCCC'], 'Cleo sees only her own room');
select results_eq($$select display_name from public.players$$, array['Cleo'], 'Cleo sees only players in her room');
select results_eq($$select round_number from public.rounds$$, array[1], 'Cleo sees only her room''s rounds');
select results_eq($$select points from public.scores$$, array[400], 'Cleo sees only her room''s scores');
select is_empty(
  $$select * from public.room_leaderboard where room_id = '00000000-0000-0000-0000-00000000aaaa'$$,
  'Cleo cannot read room A''s leaderboard'
);
select is_empty(
  $$update public.rooms set level = 'hard' where id = '00000000-0000-0000-0000-00000000aaaa' returning id$$,
  'the admin of another room cannot change room A'
);

-- Someone in no room sees no room data -----------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select is_empty($$select * from public.rooms$$, 'a user in no room sees no rooms');
select is_empty($$select * from public.players$$, 'a user in no room sees no players');
select is_empty($$select * from public.scores$$, 'a user in no room sees no scores');

-- A non-admin player (Ben) ------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select results_eq($$select code from public.rooms$$, array['AAAAAA'], 'Ben sees his room');
select results_eq(
  $$select display_name from public.players order by display_name$$,
  array['Ana', 'Ben'],
  'Ben sees the players in his room'
);
select throws_ok(
  $$update public.rooms set status = 'countdown' where id = '00000000-0000-0000-0000-00000000aaaa'$$,
  '42501', null, 'room status is not a direct update (advance_room only)'
);
select is_empty(
  $$update public.rooms set level = 'hard' where id = '00000000-0000-0000-0000-00000000aaaa' returning id$$,
  'a non-admin cannot change room settings'
);
select throws_ok(
  $$update public.players set connected = false where display_name = 'Ana'$$,
  '42501', null, 'a player cannot change another player'
);
select throws_ok(
  $$update public.players set connected = false where display_name = 'Ben'$$,
  '42501', null, 'connection flags are not a direct update (room_heartbeat only)'
);
select throws_ok(
  $$update public.players set display_name = 'Ana' where display_name = 'Ben'$$,
  '42501', null, 'a player cannot rename themselves around the duplicate-name rule'
);
select throws_ok(
  $$update public.players set is_admin = true where display_name = 'Ben'$$,
  '42501', null, 'a player cannot make themselves admin'
);
select throws_ok(
  $$insert into public.players (room_id, user_id, display_name, avatar)
    values ('00000000-0000-0000-0000-00000000cccc', '00000000-0000-0000-0000-0000000000b1', 'Ben', '🐼')$$,
  '42501', null, 'players cannot insert themselves into a room directly'
);
select throws_ok(
  $$insert into public.rooms (code, language, level) values ('BBBBBB', 'javascript', 'easy')$$,
  '42501', null, 'rooms cannot be inserted directly'
);
select throws_ok(
  $$insert into public.rounds (room_id, puzzle_id, round_number)
    values ('00000000-0000-0000-0000-00000000aaaa', 'average-rating', 2)$$,
  '42501', null, 'players cannot create rounds'
);

-- Scores cannot be edited by players --------------------------------------------

select throws_ok(
  $$update public.scores set points = 9999$$,
  '42501', null, 'a player cannot edit scores'
);
select throws_ok(
  $$insert into public.scores (round_id, player_id, passed, solve_time_ms, points)
    values ('00000000-0000-0000-0000-00000000ea01', '00000000-0000-0000-0000-0000000001a1', true, 1, 9999)$$,
  '42501', null, 'a player cannot insert scores directly'
);
select throws_ok(
  $$delete from public.scores$$,
  '42501', null, 'a player cannot delete scores'
);

-- The admin (Ana) ------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select isnt_empty(
  $$update public.rooms set level = 'medium', total_rounds = 3
    where id = '00000000-0000-0000-0000-00000000aaaa' returning id$$,
  'the admin can change room settings'
);
select throws_ok(
  $$update public.rooms set status = 'final_leaderboard', locked = true$$,
  '42501', null, 'not even the admin can set status or the lock directly'
);
select throws_ok(
  $$update public.rooms set code = 'BBBBBB'$$,
  '42501', null, 'not even the admin can change the room code'
);
select throws_ok(
  $$update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001b1'$$,
  '42501', null, 'admin hand-over is not a direct update'
);
select throws_ok(
  $$delete from public.rooms$$,
  '42501', null, 'rooms cannot be deleted through the API'
);
select throws_ok(
  $$update public.scores set points = 0$$,
  '42501', null, 'the admin cannot edit scores either'
);

-- Puzzles and private helpers -------------------------------------------------------

select isnt((select count(*) from public.puzzles), 0::bigint, 'signed-in players can read puzzles');
select throws_ok(
  $$update public.puzzles set base_points = 300$$,
  '42501', null, 'players cannot change puzzles'
);
select throws_ok(
  $$select private.generate_room_code()$$,
  '42501', null, 'private helpers are not callable from the API'
);

reset role;
set local role anon;

select isnt((select count(*) from public.puzzles), 0::bigint, 'signed-out visitors can read puzzles');
select throws_ok(
  $$insert into public.puzzles (id, language, level, title, buggy_code, tests, time_limit_seconds, base_points)
    values ('x-easy', 'javascript', 'easy', 'X', 'x', 'x', 180, 100)$$,
  '42501', null, 'signed-out visitors cannot add puzzles'
);

reset role;

select results_eq(
  $$select status::text, locked, level::text, total_rounds from public.rooms where code = 'AAAAAA'$$,
  $$values ('lobby', false, 'medium', 3)$$,
  'only the admin''s update took effect'
);

select * from finish();
rollback;
