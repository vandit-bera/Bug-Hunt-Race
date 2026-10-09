-- End of game (TB-59): tie-aware leaderboard per game, Play again (admin
-- only, new game at 0, no puzzle repeat within a game), Close room (admin
-- only, code and link refused with room_closed), and no score editing.
--
-- now() is fixed inside a transaction, so every result gets the same
-- submitted_at; the tie-break tests move submitted_at into the past (as
-- postgres) to order the solves.
begin;
select plan(42);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- Ana: admin of room A
  ('00000000-0000-0000-0000-0000000000b1'),  -- Ben
  ('00000000-0000-0000-0000-0000000000c1'),  -- Cleo
  ('00000000-0000-0000-0000-0000000000d1'),  -- Dev: leaves after game 1
  ('00000000-0000-0000-0000-0000000000f1'),  -- Finn: in no room
  ('00000000-0000-0000-0000-0000000000e1');  -- Gus: plays room B alone

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;
grant select on ids to anon;

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

-- The open round of room A.
create function pg_temp.open_round()
returns uuid
language sql
as $$
  select rd.id from public.rounds rd
  where rd.room_id = (select id from ids where name = 'room') and rd.ended_at is null;
$$;
grant execute on function pg_temp.open_round() to authenticated;

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into ids select 'ana', id from public.create_room('javascript', 'easy', 'Ana', '🦊', 2);
insert into ids select 'room', room_id from public.players where id = (select id from ids where name = 'ana');
create temp table room_code as
  select code from public.rooms where id = (select id from ids where name = 'room');
grant select on room_code to authenticated, anon;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
insert into ids select 'ben', id from public.join_room((select code from room_code), 'Ben', '🐼');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
insert into ids select 'cleo', id from public.join_room((select code from room_code), 'Cleo', '🐙');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
insert into ids select 'dev', id from public.join_room((select code from room_code), 'Dev', '🦉');
reset role;

create temp view board as
  select display_name, total_points, rounds_solved, rank, previous_rank, game_number
  from public.room_leaderboard
  where room_id = (select id from ids where name = 'room');
create temp view room_now as
  select r.status::text as status, r.current_round, r.game_number, r.closed_at is not null as has_closed_at
  from public.rooms r where r.id = (select id from ids where name = 'room');
grant select on board, room_now to authenticated;

-- Game 1, round 1: Ana, Ben and Dev solve at the same moment, Cleo gives up --

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'start');
select public.advance_room((select id from ids where name = 'room'), 'begin_round');
select public.record_score(pg_temp.open_round(), true, false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.record_score(pg_temp.open_round(), true, false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select public.record_score(pg_temp.open_round(), false, false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.record_score(pg_temp.open_round(), true, false);

select is((select status from room_now), 'round_results', 'the last result ends the round');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  $$select display_name, total_points, rounds_solved, rank, previous_rank, game_number from board order by rank, display_name$$,
  $$values ('Ana'::text, 150, 1, 1, null::integer, 1), ('Ben'::text, 150, 1, 1, null, 1),
           ('Dev'::text, 150, 1, 1, null, 1), ('Cleo'::text, 0, 0, 4, null, 1)$$,
  'exact ties (same points, same server time) share the place; no previous rank after round 1'
);
reset role;

update public.scores s set submitted_at = now() - t.ago
from (values ('ana', interval '30 seconds'), ('ben', interval '20 seconds'), ('dev', interval '10 seconds')) t (name, ago)
where s.player_id = (select id from ids where name = t.name);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  $$select display_name, rank from board order by rank$$,
  $$values ('Ana'::text, 1), ('Ben'::text, 2), ('Dev'::text, 3), ('Cleo'::text, 4)$$,
  'equal points: the earlier server timestamp of the last solve wins'
);

-- Game 1, round 2: Dev solves with the hint, Cleo solves, Ana and Ben give up --

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'next_round');
select public.advance_room((select id from ids where name = 'room'), 'begin_round');
select public.record_score(pg_temp.open_round(), false, false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.record_score(pg_temp.open_round(), false, false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.record_score(pg_temp.open_round(), true, true);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
create temp table round_two as select pg_temp.open_round() as id;
select public.record_score((select id from round_two), true, false);
reset role;

update public.scores s set submitted_at = now() - t.ago
from (values ('dev', interval '5 seconds'), ('cleo', interval '3 seconds')) t (name, ago)
where s.round_id = (select id from round_two)
  and s.player_id = (select id from ids where name = t.name);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select results_eq(
  $$select display_name, total_points, rounds_solved, rank, previous_rank from board order by rank$$,
  $$values ('Dev'::text, 275, 2, 1, 3), ('Ana'::text, 150, 1, 2, 1),
           ('Ben'::text, 150, 1, 3, 2), ('Cleo'::text, 150, 1, 4, 4)$$,
  'totals add up per game; previous_rank is the rank before the latest round (for the arrows)'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select status::text from public.advance_room((select id from ids where name = 'room'), 'finish')),
  'final_leaderboard', 'after the last round the admin shows the final leaderboard'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.leave_room((select id from ids where name = 'room'));

-- Admin only, and nobody edits scores -----------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'play_again')$$,
  'P0001', 'not_room_admin', 'a player cannot start Play again'
);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'close')$$,
  'P0001', 'not_room_admin', 'a player cannot close the room'
);
select is((select status from room_now), 'final_leaderboard', 'refused actions change nothing');

select throws_ok(
  $$update public.scores set points = 999 where player_id = (select id from ids where name = 'ben')$$,
  '42501', null, 'a player cannot change their points'
);
select throws_ok(
  $$insert into public.scores (round_id, player_id, passed, solve_time_ms, points)
    values ((select id from round_two), (select id from ids where name = 'ben'), true, 1, 999)$$,
  '42501', null, 'a player cannot insert a score'
);
select throws_ok(
  $$delete from public.scores where player_id = (select id from ids where name = 'cleo')$$,
  '42501', null, 'a player cannot delete a rival''s score'
);
select throws_ok(
  $$select public.record_score((select id from round_two), true, false)$$,
  'P0001', 'already_submitted', 'a player cannot replace a stored result'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$update public.scores set points = 0 where player_id = (select id from ids where name = 'dev')$$,
  '42501', null, 'the admin cannot change scores either'
);
select throws_ok(
  $$update public.rooms set game_number = 9 where id = (select id from ids where name = 'room')$$,
  '42501', null, 'the admin cannot set the game number directly'
);
select throws_ok(
  $$update public.rooms set status = 'lobby' where id = (select id from ids where name = 'room')$$,
  '42501', null, 'the admin cannot skip the state machine'
);

-- Play again ---------------------------------------------------------------------

select results_eq(
  $$select status::text, current_round, game_number
    from public.advance_room((select id from ids where name = 'room'), 'play_again')$$,
  $$values ('lobby', 0, 2)$$,
  'Play again: back to the lobby as game 2, round 0'
);
select results_eq(
  $$select display_name from public.players
    where room_id = (select id from ids where name = 'room') and left_at is null order by joined_at$$,
  $$values ('Ana'::text), ('Ben'::text), ('Cleo'::text)$$,
  'the same players are still in the room'
);
select results_eq(
  $$select display_name, total_points, rounds_solved, rank, previous_rank, game_number from board order by display_name$$,
  $$values ('Ana'::text, 0, 0, 1, null::integer, 2), ('Ben'::text, 0, 0, 1, null, 2), ('Cleo'::text, 0, 0, 1, null, 2)$$,
  'the new game''s leaderboard starts at 0 (Dev left and has no result in it, so is not listed)'
);
reset role;
select is(
  (select count(*) from public.scores s join public.rounds rd on rd.id = s.round_id
   where rd.room_id = (select id from ids where name = 'room') and rd.game_number = 1),
  8::bigint, 'game 1''s scores are kept'
);

-- Game 2 numbers its rounds from 1 and counts only its own results.
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'start');
select public.advance_room((select id from ids where name = 'room'), 'begin_round');
select results_eq(
  $$select game_number, round_number from public.rounds where id = pg_temp.open_round()$$,
  $$values (2, 1)$$,
  'the new game starts at round 1'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.record_score(pg_temp.open_round(), true, false);
select results_eq(
  $$select display_name, total_points, rank from board order by rank, display_name$$,
  $$values ('Ben'::text, 150, 1), ('Ana'::text, 0, 2), ('Cleo'::text, 0, 2)$$,
  'only game 2''s results count'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.advance_room((select id from ids where name = 'room'), 'stop');

-- Close room ------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'close')$$,
  'P0001', 'not_room_admin', 'a player cannot close the room from the final leaderboard'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(
  (select status::text from public.advance_room((select id from ids where name = 'room'), 'close')),
  'closed', 'the admin closes the room'
);
select is((select has_closed_at from room_now), true, 'closed_at is stamped');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  public.room_heartbeat((select id from ids where name = 'room'))::text, 'closed',
  'a player still in the room learns it closed from the heartbeat'
);
select throws_ok(
  $$select public.join_room((select code from room_code), 'Ben', '🐼')$$,
  'P0001', 'room_closed', 'a member cannot rejoin a closed room'
);
select results_eq(
  $$select display_name, total_points from board order by rank, display_name$$,
  $$values ('Ben'::text, 150), ('Ana'::text, 0), ('Cleo'::text, 0)$$,
  'members can still read the final standings'
);
select throws_ok(
  $$select public.advance_room((select id from ids where name = 'room'), 'play_again')$$,
  'P0001', 'room_not_found', 'a closed room cannot be played again'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(
  $$select public.room_heartbeat((select id from ids where name = 'room'))$$,
  'P0001', 'room_not_found', 'a player who left gets no heartbeat answer'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$select public.room_heartbeat((select id from ids where name = 'room'))$$,
  'P0001', 'room_not_found', 'an outsider learns nothing from the heartbeat'
);
select throws_ok(
  $$select public.join_room((select code from room_code), 'Finn', '🐸')$$,
  'P0001', 'room_closed', 'joining by code (or link, same code) is refused with room_closed'
);
reset role;

set local role anon;
select results_eq(
  $$select status::text, locked, is_full, player_count from public.find_open_room(lower((select code from room_code)))$$,
  $$values ('closed', false, false, 0)$$,
  'the code lookup before sign-in reports the room closed'
);
select is_empty(
  $$select * from public.find_open_room('ZZZZZZ')$$,
  'an unknown code still returns nothing'
);
reset role;

-- A closed room's code can be given to a new room; the open room wins.
insert into public.rooms (id, code, language, level)
values ('00000000-0000-0000-0000-00000000e0e0', (select code from room_code), 'python', 'hard');
set local role anon;
select results_eq(
  $$select status::text, language::text from public.find_open_room((select code from room_code))$$,
  $$values ('lobby', 'python')$$,
  'a reused code finds the new open room'
);
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is(
  (select room_id from public.join_room((select code from room_code), 'Finn', '🐸')),
  '00000000-0000-0000-0000-00000000e0e0'::uuid,
  'and joining it works'
);
reset role;

-- No repeat within a game (room B, 5 puzzles per level) --------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
insert into ids select 'gus_room', room_id from public.create_room('javascript', 'easy', 'Gus', '🐢', null);

create function pg_temp.play_game(rounds integer)
returns void
language plpgsql
as $$
declare
  room uuid := (select id from ids where name = 'gus_room');
begin
  perform public.advance_room(room, 'start');
  for i in 1..rounds loop
    if i > 1 then
      perform public.advance_room(room, 'next_round');
    end if;
    perform public.advance_room(room, 'begin_round');
    perform public.record_score(
      (select rd.id from public.rounds rd where rd.room_id = room and rd.ended_at is null),
      false, false
    );
  end loop;
  perform public.advance_room(room, 'finish');
end;
$$;
grant execute on function pg_temp.play_game(integer) to authenticated;

create temp view gus_games as
  select rd.game_number, count(*) as rounds, count(distinct rd.puzzle_id) as puzzles,
         bool_and(z.language = 'javascript' and z.level = 'easy') as right_pool
  from public.rounds rd join public.puzzles z on z.id = rd.puzzle_id
  where rd.room_id = (select id from ids where name = 'gus_room')
  group by rd.game_number;
grant select on gus_games to authenticated;

select pg_temp.play_game(5);
select results_eq(
  $$select rounds, puzzles, right_pool from gus_games where game_number = 1$$,
  $$values (5::bigint, 5::bigint, true)$$,
  'game 1: five rounds, five different puzzles from the room''s pool'
);
select public.advance_room((select id from ids where name = 'gus_room'), 'play_again');
select pg_temp.play_game(5);
select results_eq(
  $$select rounds, puzzles, right_pool from gus_games where game_number = 2$$,
  $$values (5::bigint, 5::bigint, true)$$,
  'game 2: five different puzzles again (repeats across games are allowed)'
);
select is(
  (select count(*) from public.room_leaderboard
   where room_id = (select id from ids where name = 'gus_room') and game_number = 2),
  1::bigint, 'the leaderboard follows the current game'
);
reset role;

-- Privileges ------------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated', 'private.is_closed_code(text)', 'execute'),
  'the closed-code helper is not callable through the API'
);
select ok(
  has_function_privilege('anon', 'public.find_open_room(text)', 'execute')
  and has_function_privilege('authenticated', 'public.join_room(text, text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.room_heartbeat(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.join_room(text, text, text)', 'execute'),
  'replaced functions keep their grants'
);
select ok(
  has_table_privilege('authenticated', 'public.room_leaderboard', 'select')
  and not has_table_privilege('anon', 'public.room_leaderboard', 'select'),
  'the leaderboard is readable by signed-in players only'
);
select is(
  (select array_agg(privilege_type::text order by privilege_type)
   from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'scores' and grantee = 'authenticated'),
  array['SELECT'], 'signed-in players can only read scores'
);

select * from finish();
rollback;
