-- record_score: server-side timing and points; leaderboard ranks and ties.
begin;
select plan(22);

-- Room A: Ana (admin), Ben, Dev. Room C: Cleo, Dan.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000d2');

insert into public.rooms (id, code, language, level, status, current_round) values
  ('00000000-0000-0000-0000-00000000aaaa', 'AAAAAA', 'javascript', 'easy', 'round_live', 1),
  ('00000000-0000-0000-0000-00000000cccc', 'CCCCCC', 'python', 'hard', 'round_results', 1);

insert into public.players (id, room_id, user_id, display_name, avatar) values
  ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'Ana', '🦊'),
  ('00000000-0000-0000-0000-0000000001b1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000b1', 'Ben', '🐼'),
  ('00000000-0000-0000-0000-0000000001d1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000d1', 'Dev', '🐯'),
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-00000000cccc', '00000000-0000-0000-0000-0000000000c1', 'Cleo', '🐙'),
  ('00000000-0000-0000-0000-0000000001d2', '00000000-0000-0000-0000-00000000cccc', '00000000-0000-0000-0000-0000000000d2', 'Dan', '🦉');

update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001a1'
where id = '00000000-0000-0000-0000-00000000aaaa';

-- js-easy-sum-array: 180 s limit, 100 base points. Started 60 s ago.
insert into public.rounds (id, room_id, puzzle_id, round_number, started_at) values
  ('00000000-0000-0000-0000-00000000ea01', '00000000-0000-0000-0000-00000000aaaa', 'js-easy-sum-array', 1, now() - interval '60 seconds'),
  ('00000000-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-00000000cccc', 'py-hard-lru-cache', 1, now() - interval '10 minutes');

-- Point formula ----------------------------------------------------------------

select results_eq(
  $$values
    (private.calculate_points(100, 180, 0, false)),
    (private.calculate_points(100, 180, 60000, false)),
    (private.calculate_points(100, 180, 180000, false)),
    (private.calculate_points(100, 180, 60000, true)),
    (private.calculate_points(300, 480, 240000, false))$$,
  $$values (150), (133), (100), (108), (375)$$,
  'points = base + up to 50% speed bonus - 25% hint penalty'
);

-- Access ---------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  '42501', null, 'signed-out visitors cannot record scores'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$select public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  'P0001', 'round_not_found', 'a player from another room cannot score in this round'
);

-- Ben solves at 60 s without a hint ---------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select results_eq(
  $$select passed, solve_time_ms, hint_used, points
    from public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  $$values (true, 60000, false, 133)$$,
  'solve time comes from the server clock and points are computed in the database'
);
select results_eq(
  $$select passed, hint_used, points
    from public.record_score('00000000-0000-0000-0000-00000000ea01', false, true)$$,
  $$values (true, false, 133)$$,
  'a passing result is final'
);
select is(
  (select count(*) from public.scores where player_id = '00000000-0000-0000-0000-0000000001b1'),
  1::bigint,
  'one score row per player per round'
);

-- Dev takes a hint, then solves --------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select results_eq(
  $$select passed, solve_time_ms, hint_used, points
    from public.record_score('00000000-0000-0000-0000-00000000ea01', false, true)$$,
  $$values (false, null::integer, true, 0)$$,
  'using a hint is recorded with 0 points until solved'
);
select results_eq(
  $$select passed, hint_used, points
    from public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  $$values (true, true, 108)$$,
  'the hint stays used and its penalty applies on the solve'
);

-- Leaderboard ----------------------------------------------------------------------

select results_eq(
  $$select display_name, total_points, rounds_solved, rank
    from public.room_leaderboard order by rank, display_name$$,
  $$values ('Ben'::text, 133, 1, 1), ('Dev'::text, 108, 1, 2), ('Ana'::text, 0, 0, 3)$$,
  'leaderboard ranks by points and only shows the caller''s room'
);
select throws_ok(
  $$update public.scores set points = 500 where player_id = '00000000-0000-0000-0000-0000000001d1'$$,
  '42501', null, 'a player cannot raise their own points'
);

-- Round not live -------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
reset role;
update public.rounds set paused_at = now() where id = '00000000-0000-0000-0000-00000000ea01';
set local role authenticated;
select throws_ok(
  $$select public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  'P0001', 'round_not_live', 'no scoring while paused'
);

reset role;
update public.rounds
set paused_at = null, paused_ms = 30000, started_at = now() - interval '90 seconds'
where id = '00000000-0000-0000-0000-00000000ea01';
update public.rooms set status = 'paused' where code = 'AAAAAA';
set local role authenticated;
select throws_ok(
  $$select public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  'P0001', 'round_not_live', 'no scoring unless the room is in round_live'
);

reset role;
update public.rooms set status = 'round_live' where code = 'AAAAAA';
set local role authenticated;
select results_eq(
  $$select solve_time_ms, points from public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  $$values (60000, 133)$$,
  'paused time is not counted in the solve time'
);

-- Deadline and grace ---------------------------------------------------------------

reset role;
delete from public.scores where player_id = '00000000-0000-0000-0000-0000000001a1';
update public.rounds set paused_ms = 0, started_at = now() - interval '183 seconds'
where id = '00000000-0000-0000-0000-00000000ea01';
set local role authenticated;
select results_eq(
  $$select solve_time_ms, points from public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  $$values (180000, 100)$$,
  'a pass within the 5 s grace counts at the time limit with no speed bonus'
);

reset role;
delete from public.scores where player_id = '00000000-0000-0000-0000-0000000001a1';
update public.rounds set started_at = now() - interval '186 seconds'
where id = '00000000-0000-0000-0000-00000000ea01';
set local role authenticated;
select throws_ok(
  $$select public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  'P0001', 'round_not_live', 'no scoring after the deadline plus grace'
);

reset role;
update public.rounds set started_at = now() - interval '10 seconds', ended_at = now()
where id = '00000000-0000-0000-0000-00000000ea01';
set local role authenticated;
select throws_ok(
  $$select public.record_score('00000000-0000-0000-0000-00000000ea01', true, false)$$,
  'P0001', 'round_not_live', 'no scoring after the round ended'
);
select throws_ok(
  $$select public.record_score('00000000-0000-0000-0000-0000000000ff', true, false)$$,
  'P0001', 'round_not_found', 'unknown round'
);

-- Ties -----------------------------------------------------------------------------

reset role;
insert into public.scores (round_id, player_id, passed, solve_time_ms, points) values
  ('00000000-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-0000000001c1', true, 90000, 350),
  ('00000000-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-0000000001d2', true, 90000, 350);
insert into public.rounds (id, room_id, puzzle_id, round_number) values
  ('00000000-0000-0000-0000-00000000ec02', '00000000-0000-0000-0000-00000000cccc', 'js-easy-sum-array', 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select results_eq(
  $$select display_name, rank from public.room_leaderboard order by rank, display_name$$,
  $$values ('Cleo'::text, 1), ('Dan'::text, 1)$$,
  'exact ties share the place'
);

reset role;
insert into public.scores (round_id, player_id, passed, solve_time_ms, points) values
  ('00000000-0000-0000-0000-00000000ec02', '00000000-0000-0000-0000-0000000001c1', true, 20000, 120),
  ('00000000-0000-0000-0000-00000000ec02', '00000000-0000-0000-0000-0000000001d2', true, 10000, 120);
set local role authenticated;
select results_eq(
  $$select display_name, total_points, total_solve_ms, rank
    from public.room_leaderboard order by rank, display_name$$,
  $$values ('Dan'::text, 470, 100000, 1), ('Cleo'::text, 470, 110000, 2)$$,
  'equal points: the faster total solve time wins'
);
select is_empty(
  $$select * from public.room_leaderboard where room_id = '00000000-0000-0000-0000-00000000aaaa'$$,
  'Cleo cannot see room A''s leaderboard'
);
select results_eq(
  $$select points from public.record_score('00000000-0000-0000-0000-00000000ec02', true, true)$$,
  array[120],
  'resubmitting after a pass returns the stored score unchanged'
);
reset role;

select is(
  (select points from public.scores where player_id = '00000000-0000-0000-0000-0000000001b1'),
  133,
  'Ben''s score was never changed by later calls'
);

select * from finish();
rollback;
