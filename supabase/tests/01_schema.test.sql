-- Schema-level guarantees: RLS everywhere, no reference fix, room codes.
begin;
select plan(19);

-- RLS -----------------------------------------------------------------------

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'row-level security is enabled on every public table'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'),
  array['players', 'puzzles', 'rooms', 'rounds', 'scores'],
  'the public tables are exactly the planned ones'
);

select ok(
  (select reloptions @> array['security_invoker=true']
   from pg_class where oid = 'public.room_leaderboard'::regclass),
  'room_leaderboard runs with the caller''s permissions'
);

-- Puzzles -------------------------------------------------------------------

select hasnt_column('public', 'puzzles', 'reference_fix', 'puzzles never store the reference fix');

select results_eq(
  $$select level::text from public.puzzles order by puzzles.level$$,
  array['easy', 'medium', 'hard'],
  'seed has one puzzle per level'
);

select throws_ok(
  $$insert into public.puzzles (id, language, level, title, buggy_code, tests, time_limit_seconds, base_points)
    values ('x-easy', 'javascript', 'easy', 'X', 'x', 'x', 180, 300)$$,
  '23514',
  null,
  'base points must match the level'
);

-- Room code generator -------------------------------------------------------

create temp table generated_codes as
  select private.generate_room_code() as code from generate_series(1, 5000);

select is(
  (select count(*) from generated_codes where code !~ '^[A-HJ-NP-Z2-9]{6}$'),
  0::bigint,
  'every generated code is 6 chars from A-Z/2-9'
);

select is(
  (select count(*) from generated_codes where code ~ '[0O1I]'),
  0::bigint,
  'no generated code contains 0, O, 1 or I'
);

select is(
  (select count(distinct ch)
   from generated_codes, regexp_split_to_table(code, '') as ch),
  32::bigint,
  'the generator uses all 32 allowed characters'
);

select cmp_ok(
  (select count(distinct code) from generated_codes),
  '>',
  4990::bigint,
  'generated codes are effectively unique'
);

-- Room code constraints -----------------------------------------------------

select throws_ok(
  $$insert into public.rooms (code, language, level) values ('BUG0KX', 'javascript', 'easy')$$,
  '23514',
  null,
  'a code with a look-alike character is rejected'
);

insert into public.rooms (code, language, level) values ('BUG7KX', 'javascript', 'easy');

select throws_ok(
  $$insert into public.rooms (code, language, level) values ('BUG7KX', 'python', 'hard')$$,
  '23505',
  null,
  'two open rooms cannot share a code'
);

update public.rooms set status = 'closed' where code = 'BUG7KX';

select isnt(
  (select closed_at from public.rooms where code = 'BUG7KX'),
  null,
  'closing a room stamps closed_at'
);

select lives_ok(
  $$insert into public.rooms (code, language, level) values ('BUG7KX', 'python', 'hard')$$,
  'a closed room''s code can be reused'
);

-- Admin flag sync -----------------------------------------------------------

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1');
insert into public.players (id, room_id, user_id, display_name, avatar)
select '00000000-0000-0000-0000-0000000001a1', id, '00000000-0000-0000-0000-0000000000a1', 'Ann', '🦊'
from public.rooms where code = 'BUG7KX' and status = 'lobby';
insert into public.players (id, room_id, user_id, display_name, avatar)
select '00000000-0000-0000-0000-0000000001b1', id, '00000000-0000-0000-0000-0000000000b1', 'Ben', '🐼'
from public.rooms where code = 'BUG7KX' and status = 'lobby';

update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001a1'
where code = 'BUG7KX' and status = 'lobby';
update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001b1'
where code = 'BUG7KX' and status = 'lobby';

select results_eq(
  $$select display_name, is_admin from public.players
    where id in ('00000000-0000-0000-0000-0000000001a1', '00000000-0000-0000-0000-0000000001b1')
    order by display_name$$,
  $$values ('Ann'::text, false), ('Ben'::text, true)$$,
  'players.is_admin follows rooms.admin_player_id'
);

select throws_ok(
  $$insert into public.players (room_id, user_id, display_name, avatar)
    select room_id, '00000000-0000-0000-0000-0000000000a1', 'ann', '🐙'
    from public.players where display_name = 'Ann'$$,
  '23505',
  null,
  'one player per user per room'
);

select throws_ok(
  $$update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001a1'
    where code = 'BUG7KX' and status = 'closed'$$,
  '23503',
  null,
  'the admin must be a player in the same room'
);

delete from public.players where display_name = 'Ben';
select is(
  (select admin_player_id from public.rooms where code = 'BUG7KX' and status = 'lobby'),
  null,
  'deleting the admin player clears admin_player_id'
);

update public.rooms set admin_player_id = '00000000-0000-0000-0000-0000000001a1'
where code = 'BUG7KX' and status = 'lobby';

select throws_ok(
  $$insert into public.players (room_id, user_id, display_name, avatar, is_admin)
    select room_id, '00000000-0000-0000-0000-0000000000b1', 'Ben', '🐼', true
    from public.players where display_name = 'Ann'$$,
  '23505',
  null,
  'at most one admin per room'
);

select * from finish();
rollback;
