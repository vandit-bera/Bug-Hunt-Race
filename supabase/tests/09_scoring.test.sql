-- calculate_points gives the same points as computeRaceScore
-- (lib/game/scoring.ts): the cases are RACE_CASES in scoring.test.ts.
begin;
select plan(2);

select results_eq(
  $$select private.calculate_points(base, time_limit, solve_ms, hint)
    from (values
      (1, 100, 180, 0, false),
      (2, 100, 180, 30000, false),
      (3, 100, 180, 60000, false),
      (4, 100, 120, 30000, false),
      (5, 100, 180, 60000, true),
      (6, 200, 300, 100000, false),
      (7, 200, 300, 100000, true),
      (8, 300, 480, 240000, false),
      (9, 300, 480, 1000, true),
      (10, 100, 180, 179999, false),
      (11, 100, 180, 180000, false),
      (12, 100, 180, 180000, true),
      (13, 100, 180, 19800, false),
      (14, 200, 300, 127500, false),
      (15, 300, 480, 100800, false)
    ) as cases (n, base, time_limit, solve_ms, hint)
    order by n$$,
  $$values (150), (142), (133), (138), (108), (267), (217), (375), (375), (100), (100), (75), (145), (258), (419)$$,
  'race points match computeRaceScore: speed bonus and hint penalty round half up'
);

select function_privs_are(
  'private', 'calculate_points', array['integer', 'integer', 'integer', 'boolean'],
  'authenticated', array[]::text[],
  'players still cannot call calculate_points'
);

select * from finish();
rollback;
