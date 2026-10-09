-- What the Data API exposes, as found by the pre-launch security review
-- (TB-63, docs/SECURITY_REVIEW.md). Checks the catalog, so a new table,
-- grant or function that widens the attack surface fails here until the
-- review table is updated on purpose.
begin;
select plan(10);

select is_empty(
  $$
    select n.nspname || '.' || c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every table in public and private has row-level security on'
);

select results_eq(
  $$
    select c.relname::text collate "default"
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)
    order by 1
  $$,
  $$select null::text where false$$,
  'every public view runs with the caller''s rights (security_invoker)'
);

select results_eq(
  $$
    select table_name::text collate "default", privilege_type::text collate "default"
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema in ('public', 'private')
    order by 1, 2
  $$,
  $$values ('puzzles', 'SELECT')$$,
  'anon can read puzzles and nothing else'
);

select results_eq(
  $$
    select distinct table_name::text collate "default", privilege_type::text collate "default"
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema in ('public', 'private')
    order by 1, 2
  $$,
  $$values
    ('players', 'SELECT'),
    ('puzzles', 'SELECT'),
    ('room_leaderboard', 'SELECT'),
    ('rooms', 'SELECT'),
    ('rounds', 'SELECT'),
    ('scores', 'SELECT')$$,
  'signed-in players only read tables; no table-wide writes'
);

select results_eq(
  $$
    select table_name::text collate "default", column_name::text collate "default"
    from information_schema.column_privileges
    where grantee in ('anon', 'authenticated')
      and table_schema in ('public', 'private')
      and privilege_type <> 'SELECT'
    order by 1, 2
  $$,
  $$values ('rooms', 'language'), ('rooms', 'level'), ('rooms', 'total_rounds')$$,
  'the only direct writes are the room settings (admin only, by RLS)'
);

select results_eq(
  $$
    select p.proname::text collate "default"
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')
    order by 1
  $$,
  $$values ('find_open_room')$$,
  'anon can call find_open_room only'
);

select results_eq(
  $$
    select (n.nspname || '.' || p.proname) collate "default"
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('authenticated', p.oid, 'execute')
    order by 1
  $$,
  $$values
    ('private.is_room_admin'),
    ('private.is_room_member'),
    ('private.is_round_member'),
    ('public.advance_room'),
    ('public.create_room'),
    ('public.find_open_room'),
    ('public.get_current_round'),
    ('public.join_room'),
    ('public.leave_room'),
    ('public.record_score'),
    ('public.reveal_round_puzzle'),
    ('public.room_heartbeat'),
    ('public.set_room_locked')$$,
  'signed-in players can call the API functions and the RLS helpers only'
);

select is_empty(
  $$
    select n.nspname || '.' || p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not coalesce('search_path=""' = any (p.proconfig), false)
  $$,
  'every function pins search_path to empty (no search_path hijack)'
);

select results_eq(
  $$
    select tablename::text collate "default"
    from pg_publication_tables
    where pubname = 'supabase_realtime'
    order by 1
  $$,
  $$values ('players'), ('rooms')$$,
  'Realtime publishes rooms and players only (RLS-filtered)'
);

select is_empty(
  $$
    select table_schema || '.' || table_name || '.' || column_name
    from information_schema.columns
    where table_schema in ('public', 'private')
      and column_name ~* '(fix|solution|answer)'
  $$,
  'no table or view has a column for the reference fix'
);

select * from finish();
rollback;
