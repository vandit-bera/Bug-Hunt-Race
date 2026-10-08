-- Abuse limits: room creation rate, no HTML in names or avatars.
begin;
select plan(11);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- Ana: creates many rooms
  ('00000000-0000-0000-0000-0000000000b1');  -- Ben: someone else

-- An hour-old create no longer counts (inserted as postgres).
insert into private.room_creations (user_id, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', now() - interval '61 minutes');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- Names and avatars ------------------------------------------------------------

select throws_ok(
  $$select public.create_room('javascript', 'easy', '<b>Ana</b>', '🦊')$$,
  'P0001',
  'invalid_display_name',
  'names with HTML are rejected'
);
select throws_ok(
  $$select public.create_room('javascript', 'easy', 'a > b', '🦊')$$,
  'P0001',
  'invalid_display_name',
  'a lone > is rejected too'
);
select throws_ok(
  $$select public.create_room('javascript', 'easy', 'Ana', '<img>')$$,
  'P0001',
  'invalid_avatar',
  'avatars with HTML are rejected'
);
select lives_ok(
  $$select public.create_room('javascript', 'easy', 'Ana & Co. "AC" 🦊', '🦊')$$,
  'other punctuation and emoji are fine'
);

-- Room creation rate -----------------------------------------------------------

select lives_ok(
  $$select public.create_room('javascript', 'easy', 'Ana', '🦊')
    from generate_series(1, 9)$$,
  'up to 10 rooms an hour (1 above + 9 here)'
);
select throws_ok(
  $$select public.create_room('javascript', 'easy', 'Ana', '🦊')$$,
  'P0001',
  'rate_limited',
  'the 11th room in an hour is refused'
);

reset role;
select is(
  (select count(*)::integer from public.rooms r
   join public.players p on p.id = r.admin_player_id
   where p.user_id = '00000000-0000-0000-0000-0000000000a1'),
  10,
  'the refused create left no room behind'
);
select is(
  (select count(*)::integer from private.room_creations
   where user_id = '00000000-0000-0000-0000-0000000000a1'),
  10,
  'the hour-old entry was pruned and refused creates are not logged'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok(
  $$select public.create_room('python', 'hard', 'Ben', '🐙')$$,
  'the limit is per user'
);
reset role;

select lives_ok(
  $$insert into public.rooms (code, language, level) values ('ZZZZZZ', 'javascript', 'easy')$$,
  'inserts without a user (seed, migrations) are not limited'
);

set local role authenticated;
select throws_ok(
  $$select count(*) from private.room_creations$$,
  '42501',
  null,
  'players cannot read the log'
);

select * from finish();
rollback;
