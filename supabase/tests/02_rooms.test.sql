-- create_room, join_room, find_open_room: codes, duplicate names, lock, full.
begin;
select plan(25);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- Ana: creates the room
  ('00000000-0000-0000-0000-0000000000b1'),  -- second "Riya"
  ('00000000-0000-0000-0000-0000000000d1'),  -- third "riya"
  ('00000000-0000-0000-0000-0000000000e1');  -- arrives after the lock

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

-- create_room ---------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.create_room('javascript', 'easy', 'Riya', '🦊')$$,
  '42501',
  null,
  'signed-out visitors cannot create rooms'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select public.create_room('javascript', 'easy', 'Riya', '🦊')$$,
  'P0001',
  'not_authenticated',
  'create_room needs a user'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$select public.create_room('javascript', 'easy', '   ', '🦊')$$,
  'P0001',
  'invalid_display_name',
  'blank names are rejected'
);
select throws_ok(
  $$select public.create_room('javascript', 'easy', repeat('x', 25), '🦊')$$,
  'P0001',
  'invalid_display_name',
  'names over 24 chars are rejected'
);
select throws_ok(
  $$select public.create_room('javascript', 'easy', 'Riya', '')$$,
  'P0001',
  'invalid_avatar',
  'an avatar is required'
);
select throws_ok(
  $$select public.create_room('javascript', 'easy', 'Riya', '🦊', 0)$$,
  'P0001',
  'invalid_total_rounds',
  'rounds must be at least 1'
);

insert into ids select 'ana', id from public.create_room('typescript', 'mixed', 'Riya', '🦊', 5);
insert into ids select 'room', room_id from public.players where id = (select id from ids where name = 'ana');
reset role;

select results_eq(
  $$select status::text, language::text, level::text, total_rounds, locked, current_round
    from public.rooms where id = (select id from ids where name = 'room')$$,
  $$values ('lobby', 'typescript', 'mixed', 5, false, 0)$$,
  'create_room opens a room in the lobby with the chosen settings'
);
select matches(
  (select code from public.rooms where id = (select id from ids where name = 'room')),
  '^[A-HJ-NP-Z2-9]{6}$',
  'the room gets a valid code'
);
select is(
  (select admin_player_id from public.rooms where id = (select id from ids where name = 'room')),
  (select id from ids where name = 'ana'),
  'the creator is the room admin'
);
select is(
  (select is_admin from public.players where id = (select id from ids where name = 'ana')),
  true,
  'the creator''s player row is flagged admin'
);

-- find_open_room ------------------------------------------------------------

create temp table room_code as
  select code from public.rooms where id = (select id from ids where name = 'room');
grant select on room_code to anon, authenticated;

set local role anon;
select results_eq(
  $$select status::text, locked, is_full, player_count from public.find_open_room(lower((select code from room_code)))$$,
  $$values ('lobby', false, false, 1)$$,
  'anyone can look up an open room by code, in any case'
);
select is_empty(
  $$select * from public.find_open_room('ZZZZZZ')$$,
  'unknown codes return nothing'
);
select throws_ok(
  $$select * from public.rooms$$,
  '42501',
  null,
  'signed-out visitors cannot read rooms directly'
);
reset role;

-- join_room: duplicate names ------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$select public.join_room('ZZZZZZ', 'Riya', '🐼')$$,
  'P0001',
  'room_not_found',
  'unknown code: room_not_found'
);
insert into ids select 'riya2', id from public.join_room(' ' || lower((select code from room_code)) || ' ', '  Riya ', '🐼');
select is(
  (select display_name from public.players where id = (select id from ids where name = 'riya2')),
  'Riya (2)',
  'a duplicate name becomes "Riya (2)"'
);
select is(
  (select id from public.join_room((select code from room_code), 'Someone Else', '🐸')),
  (select id from ids where name = 'riya2'),
  'rejoining returns the same player'
);
select is(
  (select display_name from public.players where id = (select id from ids where name = 'riya2')),
  'Riya (2)',
  'rejoining keeps the original name'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is(
  (select display_name from public.join_room((select code from room_code), 'riya', '🐯')),
  'riya (3)',
  'names are compared case-insensitively: "riya" becomes "riya (3)"'
);
reset role;

-- Lock and close ------------------------------------------------------------

update public.rooms set locked = true where id = (select id from ids where name = 'room');
update public.players set connected = false where id = (select id from ids where name = 'riya2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$select public.join_room((select code from room_code), 'Eve', '🦉')$$,
  'P0001',
  'room_locked',
  'new players cannot join a locked room'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  (select connected from public.join_room((select code from room_code), 'Riya', '🐼')),
  true,
  'an existing player can rejoin a locked room and is marked connected'
);
reset role;

update public.rooms set locked = false where id = (select id from ids where name = 'room');

-- Fill the room to the 30-player cap.
insert into auth.users (id)
select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid from generate_series(1, 27) i;
insert into public.players (room_id, user_id, display_name, avatar)
select (select id from ids where name = 'room'),
       ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid,
       'Filler ' || i, '🤖'
from generate_series(1, 27) i;

set local role anon;
select results_eq(
  $$select is_full, player_count from public.find_open_room((select code from room_code))$$,
  $$values (true, 30)$$,
  'find_open_room reports a full room'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$select public.join_room((select code from room_code), 'Eve', '🦉')$$,
  'P0001',
  'room_full',
  'nobody new can join a full room'
);
reset role;

update public.rooms set status = 'closed' where id = (select id from ids where name = 'room');

set local role authenticated;
select throws_ok(
  $$select public.join_room((select code from room_code), 'Eve', '🦉')$$,
  'P0001',
  'room_closed',
  'a closed room cannot be joined: room_closed, not room_not_found'
);
reset role;

set local role anon;
select results_eq(
  $$select status::text, locked, is_full, player_count from public.find_open_room((select code from room_code))$$,
  $$values ('closed', false, false, 0)$$,
  'a closed room''s code reports status closed and nothing else about it'
);
reset role;

-- Privileges ----------------------------------------------------------------

set local role anon;
select throws_ok(
  $$select public.join_room('BUG7KX', 'Riya', '🦊')$$,
  '42501',
  null,
  'signed-out visitors cannot join rooms'
);
reset role;

select * from finish();
rollback;
