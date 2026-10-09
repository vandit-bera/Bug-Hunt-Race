-- DB hardening (TB-66, docs/SECURITY_REVIEW.md L1–L3): room settings are
-- lobby-only, room_heartbeat checks membership before it locks the room, and
-- only players still in the room may use its Realtime channel.
begin;
select plan(17);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- Ana: admin of room A
  ('00000000-0000-0000-0000-0000000000b1'),  -- Ben: in room A, leaves at the end
  ('00000000-0000-0000-0000-0000000000f1'),  -- Finn: in no room
  ('00000000-0000-0000-0000-0000000000e1');  -- Gus: admin of room B

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

-- The topic Realtime sets while it authorizes a join to a private channel.
create function pg_temp.on_channel(target_room_id uuid)
returns void
language sql
as $$
  select set_config('realtime.topic', 'room:' || target_room_id::text, true);
$$;
grant execute on function pg_temp.on_channel(uuid) to authenticated;

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into ids select 'room', room_id from public.create_room('javascript', 'easy', 'Ana', '🦊', 3);
create temp table room_code as
  select code from public.rooms where id = (select id from ids where name = 'room');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
insert into ids select 'room_b', room_id from public.create_room('python', 'hard', 'Gus', '🐙', 2);
reset role;

-- L2: room_heartbeat --------------------------------------------------------------

-- A row lock leaves the locker in the row's xmax, even when the
-- (sub)transaction that took it rolls back, as throws_ok's does. Runs before
-- anyone joins: join_room locks the row for this whole transaction, and a
-- second lock of the same kind would leave no trace.
create temp table room_xmax as
  select xmax::text as before from public.rooms where id = (select id from ids where name = 'room');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$select public.room_heartbeat((select id from ids where name = 'room'))$$,
  'P0001', 'room_not_found', 'an outsider''s heartbeat is refused'
);
reset role;
select is(
  (select xmax::text from public.rooms where id = (select id from ids where name = 'room')),
  (select before from room_xmax),
  'an outsider''s heartbeat does not lock the room row'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.join_room((select code from room_code), 'Ben', '🐻');
select is(
  public.room_heartbeat((select id from ids where name = 'room'))::text,
  'lobby', 'a player''s heartbeat still returns the room status'
);
reset role;

-- L1: settings are lobby-only -----------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
update public.rooms set language = 'python', level = 'medium', total_rounds = 5
where id = (select id from ids where name = 'room');
select results_eq(
  $$select language::text, level::text, total_rounds from public.rooms where id = (select id from ids where name = 'room')$$,
  $$values ('python', 'medium', 5)$$,
  'the admin can change the settings in the lobby'
);

select public.advance_room((select id from ids where name = 'room'), 'start');
select throws_ok(
  $$update public.rooms set language = 'javascript' where id = (select id from ids where name = 'room')$$,
  'P0001', 'room_settings_locked', 'the language cannot change once the game has started'
);
select throws_ok(
  $$update public.rooms set level = 'hard' where id = (select id from ids where name = 'room')$$,
  'P0001', 'room_settings_locked', 'the level cannot change once the game has started'
);
select throws_ok(
  $$update public.rooms set total_rounds = 1 where id = (select id from ids where name = 'room')$$,
  'P0001', 'room_settings_locked', 'the number of rounds cannot change once the game has started'
);
select lives_ok(
  $$update public.rooms set total_rounds = 5 where id = (select id from ids where name = 'room')$$,
  'writing the same settings again is not a change'
);
reset role;
select results_eq(
  $$select language::text, level::text, total_rounds from public.rooms where id = (select id from ids where name = 'room')$$,
  $$values ('python', 'medium', 5)$$,
  'the settings are unchanged after the game started'
);

-- L3: the room's Realtime channel ---------------------------------------------------

set local role authenticated;
select pg_temp.on_channel((select id from ids where name = 'room'));
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select ok(private.can_use_room_channel(), 'the admin may use the room channel');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select ok(private.can_use_room_channel(), 'a player may use the room channel');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select ok(not private.can_use_room_channel(), 'an outsider may not use the room channel');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select ok(not private.can_use_room_channel(), 'a player of another room may not use the room channel');
select pg_temp.on_channel((select id from ids where name = 'room_b'));
select ok(private.can_use_room_channel(), '... but may use their own room''s channel');

select set_config('realtime.topic', 'room:not-a-uuid', true);
select ok(not private.can_use_room_channel(), 'a malformed topic is refused, not an error');

select pg_temp.on_channel((select id from ids where name = 'room'));
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.leave_room((select id from ids where name = 'room'));
select ok(not private.can_use_room_channel(), 'a player who left may not use the room channel');
reset role;

select is(
  (
    select array_agg(polname::text || ':' || polcmd::text order by polname)
    from pg_policy
    where polrelid = 'realtime.messages'::regclass
  ),
  array[
    'Room players can read the room channel:r',
    'Room players can track presence on the room channel:a'
  ],
  'the room channel policies are the only Realtime policies'
);

select * from finish();
rollback;
