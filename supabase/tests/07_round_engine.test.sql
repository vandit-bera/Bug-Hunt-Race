-- Round engine (TB-53): admin-only round actions, puzzle picking, the server
-- clock and pauses, one result per player, late joiners, automatic round end,
-- and the fix reveal check.
--
-- now() is fixed inside a transaction, so time passing is simulated by moving
-- started_at / paused_at / joined_at into the past (as postgres).
begin;
select plan(59);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- Ana: admin
  ('00000000-0000-0000-0000-0000000000b1'),  -- Ben
  ('00000000-0000-0000-0000-0000000000c1'),  -- Cleo
  ('00000000-0000-0000-0000-0000000000d1'),  -- Dev: joins mid-round
  ('00000000-0000-0000-0000-0000000000f1');  -- Finn: in no room

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

create function pg_temp.act_as(user_id text)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', user_id),
    true
  );
$$;
grant execute on function pg_temp.act_as(text) to authenticated;

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into ids select 'ana', id from public.create_room('javascript', 'easy', 'Ana', '🦊', null);
insert into ids select 'room', room_id from public.players where id = (select id from ids where name = 'ana');
create temp table room_code as
  select code from public.rooms where id = (select id from ids where name = 'room');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into ids select 'ben', id from public.join_room((select code from room_code), 'Ben', '🐼');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into ids select 'cleo', id from public.join_room((select code from room_code), 'Cleo', '🐙');
reset role;

-- Everyone joined an hour ago, well before any round starts.
update public.players set joined_at = now() - interval '1 hour'
where room_id = (select id from ids where name = 'room');

create temp view room_now as
  select r.status::text as status, r.current_round, r.game_number
  from public.rooms r where r.id = (select id from ids where name = 'room');
create temp view open_round as
  select rd.* from public.rounds rd
  where rd.room_id = (select id from ids where name = 'room') and rd.ended_at is null;
grant select on room_now, open_round to authenticated;

-- Admin only -----------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'start');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'begin_round')$$,
  'P0001', 'not_room_admin', 'a player cannot start the round'
);
select is(
  (select count(*) from public.rounds where room_id = (select id from ids where name = 'room')),
  0::bigint, 'a refused start creates no round'
);
select is_empty(
  $$select * from public.get_current_round((select id from ids where name = 'room'))$$,
  'no current round during the countdown'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select status::text from public.advance_room((select id from ids where name = 'room'), 'begin_round')),
  'round_live', 'the admin starts the round'
);
reset role;

select results_eq(
  $$select z.language::text, z.level::text, r.round_number, r.game_number, r.started_at = now(), r.paused_ms
    from open_round r join public.puzzles z on z.id = r.puzzle_id$$,
  $$values ('javascript', 'easy', 1, 1, true, 0)$$,
  'the round gets a puzzle in the room''s language and level, started on the server clock'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'pause')$$,
  'P0001', 'not_room_admin', 'a player cannot pause'
);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'end_round')$$,
  'P0001', 'not_room_admin', 'a player cannot skip'
);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'stop')$$,
  'P0001', 'not_room_admin', 'a player cannot stop the game'
);

-- Same round for everyone ------------------------------------------------------

create temp table seen (name text, puzzle_id text, started_at timestamptz, server_now timestamptz);
grant insert on seen to authenticated;
insert into seen select 'ben', puzzle_id, started_at, server_now
  from public.get_current_round((select id from ids where name = 'room'));
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into seen select 'cleo', puzzle_id, started_at, server_now
  from public.get_current_round((select id from ids where name = 'room'));
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into seen select 'ana', puzzle_id, started_at, server_now
  from public.get_current_round((select id from ids where name = 'room'));
reset role;

select is(
  (select count(distinct (puzzle_id, started_at)) from seen),
  1::bigint, 'every player gets the same puzzle and start time'
);
select ok(
  (select bool_and(puzzle_id = (select puzzle_id from open_round) and server_now = now()) from seen),
  'get_current_round returns the round''s puzzle and the server''s clock'
);
select results_eq(
  $$select r.buggy_code = z.buggy_code, r.tests = z.tests, r.time_limit_seconds, r.joined_late, r.submitted
    from public.get_current_round((select id from ids where name = 'room')) r
    join public.puzzles z on z.id = r.puzzle_id$$,
  $$values (true, true, 180, false, false)$$,
  'the current round carries the puzzle the players need'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$select * from public.get_current_round((select id from ids where name = 'room'))$$,
  'P0001', 'room_not_found', 'someone outside the room cannot read its round'
);
reset role;

-- Pause and resume -----------------------------------------------------------------

-- 40 s into the round the admin pauses...
update public.rounds set started_at = now() - interval '40 seconds'
where id = (select id from open_round);
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'pause');
reset role;
select ok((select paused_at = now() from open_round), 'pause freezes the clock at the server time');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.record_score((select id from open_round), true, false)$$,
  'P0001', 'round_not_live', 'no results while paused'
);
reset role;

-- ...and resumes 30 s later.
update public.rounds
set started_at = now() - interval '70 seconds', paused_at = now() - interval '30 seconds'
where id = (select id from open_round);
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'resume');
reset role;
select results_eq(
  $$select paused_at, paused_ms from open_round$$,
  $$values (null::timestamptz, 30000)$$,
  'resume adds the pause to the paused time'
);

-- Results ----------------------------------------------------------------------------

-- Dev joins now, 70 s after the round started.
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
insert into ids select 'dev', id from public.join_room((select code from room_code), 'Dev', '🐯');
select results_eq(
  $$select joined_late, submitted from public.get_current_round((select id from ids where name = 'room'))$$,
  $$values (true, false)$$,
  'a late joiner is told they joined late'
);
select throws_ok(
  $$select public.record_score((select id from open_round), true, false)$$,
  'P0001', 'joined_late', 'a late joiner cannot submit to the current round'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  $$select passed, solve_time_ms, hint_used, points
    from public.record_score((select id from open_round), true, false)$$,
  $$values (true, 40000, false, 139)$$,
  'the solve time is measured by the server, without the pause'
);
select throws_ok(
  $$select public.record_score((select id from open_round), true, false)$$,
  'P0001', 'already_submitted', 'a second result is refused'
);
select results_eq(
  $$select submitted from public.get_current_round((select id from ids where name = 'room'))$$,
  array[true],
  'get_current_round shows the player has submitted'
);
select is((select status from room_now), 'round_live', 'the round goes on while players are still solving');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$select passed, solve_time_ms, hint_used, points
    from public.record_score((select id from open_round), false, true)$$,
  $$values (false, null::integer, true, 0)$$,
  'giving up is a result with 0 points'
);
select is((select status from room_now), 'round_live', 'the admin has not finished yet');

-- Fix reveal check -------------------------------------------------------------------

create temp table round_one as select id, puzzle_id from open_round;
grant select on round_one to authenticated;

select throws_ok(
  $$select public.reveal_round_puzzle((select id from round_one))$$,
  'P0001', 'round_not_over', 'the fix is not revealed while the round is on'
);

-- Everyone in at the start has a result: the round ends -------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$select public.record_score((select id from round_one), true, true)$$,
  'the admin submits too'
);
reset role;
select is((select status from room_now), 'round_results', 'the round ends when every player has a result');
select ok(
  (select ended_at = now() from public.rounds where id = (select id from round_one)),
  'the round is marked ended'
);
select is(
  (select count(*) from public.scores where round_id = (select id from round_one)),
  3::bigint, 'the late joiner has no result'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  public.reveal_round_puzzle((select id from round_one)),
  (select puzzle_id from round_one),
  'after the round, players get the puzzle id for the fix reveal'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(
  public.reveal_round_puzzle((select id from round_one)),
  (select puzzle_id from round_one),
  'a late joiner sees the fix too'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$select public.reveal_round_puzzle((select id from round_one))$$,
  'P0001', 'round_not_found', 'someone outside the room gets nothing'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$select public.record_score((select id from round_one), true, false)$$,
  'P0001', 'already_submitted', 'a result is final'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.reveal_round_puzzle((select id from round_one))$$,
  '42501', null, 'signed-out visitors cannot call the reveal check'
);
reset role;

-- Round 2: a disconnected player does not hold the round up, time up ends it ----------

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'next_round');
select public.advance_room((select id from ids where name = 'room'), 'begin_round');
reset role;
select isnt(
  (select puzzle_id from open_round), (select puzzle_id from round_one),
  'round 2 gets a different puzzle'
);
select results_eq(
  $$select round_number from open_round$$, array[2], 'the round is numbered from the room'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select lives_ok(
  $$select public.record_score((select id from open_round), true, false)$$,
  'a player who joined before the round started can submit'
);
reset role;

-- Ben and Cleo drop; Dev's and Ana's results are what counts.
update public.players set connected = false
where id in ((select id from ids where name = 'ben'), (select id from ids where name = 'cleo'));
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.room_heartbeat((select id from ids where name = 'room'));
reset role;
select is((select status from room_now), 'round_live', 'the admin has no result yet: the round goes on');

-- The time limit (180 s) and the 5 s grace pass.
update public.rounds set started_at = now() - interval '186 seconds'
where id = (select id from open_round);
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$select public.record_score((select id from open_round), true, false)$$,
  'P0001', 'round_not_live', 'no results after the deadline plus grace'
);
select is(
  public.room_heartbeat((select id from ids where name = 'room'))::text,
  'round_results', 'a heartbeat ends the round once time is up'
);
reset role;
select is_empty($$select * from open_round$$, 'the timed-out round is ended');

-- Stop while paused --------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'next_round');
select public.advance_room((select id from ids where name = 'room'), 'begin_round');
select public.advance_room((select id from ids where name = 'room'), 'pause');
reset role;
update public.rounds set paused_at = now() - interval '12 seconds'
where id = (select id from open_round);
create temp table round_three as select id from open_round;
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select status::text from public.advance_room((select id from ids where name = 'room'), 'stop')),
  'final_leaderboard', 'stop from paused goes to the final leaderboard'
);
reset role;
select results_eq(
  $$select paused_at, paused_ms, ended_at = now() from public.rounds where id = (select id from round_three)$$,
  $$values (null::timestamptz, 12000, true)$$,
  'stop ends the round and counts the pause in progress'
);
select results_eq(
  $$select round_number, ended_at is not null
    from public.get_current_round((select id from ids where name = 'room'))$$,
  $$values (3, true)$$,
  'the final leaderboard still shows the last round'
);

-- No repeats within a game, a new game starts fresh ----------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select results_eq(
  $$select status::text, current_round, game_number
    from public.advance_room((select id from ids where name = 'room'), 'play_again')$$,
  $$values ('lobby', 0, 2)$$,
  'play again starts game 2'
);
reset role;

-- Play every JavaScript Easy puzzle in game 2 (plus one more round).
create temp table pool as
  select id from public.puzzles where language = 'javascript' and level = 'easy' and active;
grant select on pool to authenticated;
do $$
declare
  room_id uuid := (select id from ids where name = 'room');
begin
  execute 'set local role authenticated';
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  perform public.advance_room(room_id, 'start');
  perform public.advance_room(room_id, 'begin_round');
  for i in 2..(select count(*) + 1 from pool) loop
    perform public.advance_room(room_id, 'end_round');
    perform public.advance_room(room_id, 'next_round');
    perform public.advance_room(room_id, 'begin_round');
  end loop;
  execute 'reset role';
end;
$$;

select results_eq(
  $$select round_number from public.rounds
    where room_id = (select id from ids where name = 'room') and game_number = 2 and round_number = 1$$,
  array[1], 'a new game numbers its rounds from 1 again'
);
select is(
  (select count(distinct puzzle_id) from public.rounds
   where room_id = (select id from ids where name = 'room') and game_number = 2
     and round_number <= (select count(*) from pool)),
  (select count(*) from pool),
  'no puzzle repeats within a game until the pool is used up'
);
select isnt(
  (select puzzle_id from public.rounds
   where room_id = (select id from ids where name = 'room') and game_number = 2
     and round_number = (select count(*) + 1 from pool)),
  (select puzzle_id from public.rounds
   where room_id = (select id from ids where name = 'room') and game_number = 2
     and round_number = (select count(*) from pool)),
  'after the pool is used up, the puzzle just played does not come straight back'
);

-- Mixed steps up, and falls back when a level is empty ---------------------------------------

select results_eq(
  $$select r, private.levels_for_round('mixed', r)::text[]
    from generate_series(1, 4) r$$,
  $$values
    (1, array['easy', 'medium', 'hard']),
    (2, array['medium', 'hard', 'easy']),
    (3, array['hard', 'medium', 'easy']),
    (4, array['hard', 'medium', 'easy'])$$,
  'Mixed plays Easy, then Medium, then Hard from round 3 on'
);
select results_eq(
  $$select private.levels_for_round('medium', 1)::text[]$$,
  $$values (array['medium'])$$,
  'a fixed level only plays that level'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into ids select 'mixed_admin', id from public.create_room('python', 'mixed', 'Ana', '🦊', null);
insert into ids select 'mixed', room_id from public.players where id = (select id from ids where name = 'mixed_admin');
reset role;

do $$
declare
  room_id uuid := (select id from ids where name = 'mixed');
begin
  execute 'set local role authenticated';
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  perform public.advance_room(room_id, 'start');
  perform public.advance_room(room_id, 'begin_round');
  for i in 2..4 loop
    perform public.advance_room(room_id, 'end_round');
    perform public.advance_room(room_id, 'next_round');
    perform public.advance_room(room_id, 'begin_round');
  end loop;
  execute 'reset role';
end;
$$;

select results_eq(
  $$select r.round_number, z.level::text
    from public.rounds r join public.puzzles z on z.id = r.puzzle_id
    where r.room_id = (select id from ids where name = 'mixed')
    order by r.round_number$$,
  $$values (1, 'easy'), (2, 'medium'), (3, 'hard'), (4, 'hard')$$,
  'a Mixed room steps up Easy, Medium, Hard'
);

-- Without Medium puzzles, round 2 of a Mixed game is Hard.
update public.puzzles set active = false where language = 'typescript' and level = 'medium';
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into ids select 'ts_admin', id from public.create_room('typescript', 'mixed', 'Ana', '🦊', null);
insert into ids select 'ts', room_id from public.players where id = (select id from ids where name = 'ts_admin');
select public.advance_room((select id from ids where name = 'ts'), 'start');
select public.advance_room((select id from ids where name = 'ts'), 'begin_round');
select public.advance_room((select id from ids where name = 'ts'), 'end_round');
select public.advance_room((select id from ids where name = 'ts'), 'next_round');
select public.advance_room((select id from ids where name = 'ts'), 'begin_round');
reset role;
select results_eq(
  $$select z.level::text from public.rounds r join public.puzzles z on z.id = r.puzzle_id
    where r.room_id = (select id from ids where name = 'ts') and r.round_number = 2$$,
  array['hard'],
  'a level with no puzzles falls back to a harder one'
);

-- With no puzzles at all, the round cannot start.
update public.puzzles set active = false where language = 'typescript';
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'ts'), 'end_round');
select public.advance_room((select id from ids where name = 'ts'), 'next_round');
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'ts'), 'begin_round')$$,
  'P0001', 'no_puzzles', 'no active puzzle: no round'
);
reset role;
select is(
  (select status::text from public.rooms where id = (select id from ids where name = 'ts')),
  'countdown', 'the room stays in the countdown'
);
select is(
  (select count(*) from public.rounds where room_id = (select id from ids where name = 'ts')),
  2::bigint, 'and no round was created'
);

-- Abandoning a room mid-round ends the round -------------------------------------------------

update public.puzzles set active = true where language = 'typescript';
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'ts'), 'begin_round');
reset role;
select private.apply_room_event((select id from ids where name = 'ts'), 'abandon', 'system');
select is_empty(
  $$select * from public.rounds where room_id = (select id from ids where name = 'ts') and ended_at is null$$,
  'closing an abandoned room ends its round'
);

-- Privileges ---------------------------------------------------------------------------------

set local role authenticated;
select throws_ok(
  $$select private.end_round_if_over((select id from ids where name = 'room'))$$,
  '42501', null, 'players cannot call the round helpers'
);
select throws_ok(
  $$select private.pick_puzzle(r) from public.rooms r limit 1$$,
  '42501', null, 'players cannot pick puzzles'
);
select throws_ok(
  $$update public.rooms set game_number = 9 where id = (select id from ids where name = 'room')$$,
  '42501', null, 'players cannot change the game number'
);
select throws_ok(
  $$update public.rounds set started_at = now() where id = (select id from round_one)$$,
  '42501', null, 'players cannot move a round''s clock'
);
reset role;

select * from finish();
rollback;
