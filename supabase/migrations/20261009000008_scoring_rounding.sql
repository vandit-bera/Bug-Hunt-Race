-- Bug Hunt Race: race points round like Solo (TB-36).
--
-- private.calculate_points floored the speed bonus and the hint penalty,
-- while lib/game/scoring.ts (Solo, and the race results screens) rounds
-- them, so a race solve could score 1 point less than the same solve in
-- Solo. Now both round half up. Same signature, so record_score and the
-- grants are unchanged. Results already stored keep their points.
--
-- Rollback: re-run the calculate_points definition from
-- 20261008000003_room_functions.sql (floor instead of round).

create or replace function private.calculate_points(
  base_points integer,
  time_limit_seconds integer,
  solve_time_ms integer,
  hint_used boolean
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(
    0,
    base_points
      + round(
          base_points * 0.5
          * greatest(0, time_limit_seconds * 1000 - solve_time_ms)
          / (time_limit_seconds * 1000.0)
        )::integer
      - case when hint_used then round(base_points * 0.25)::integer else 0 end
  );
$$;
