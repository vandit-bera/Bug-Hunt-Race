# Puzzles

Every puzzle is a short piece of code with a bug in it, a set of tests that
expose the bug, and a reference fix. Players get the buggy code and the
tests; the fix never leaves this folder.

**The rule:** the buggy code must **fail** at least one test and the reference
fix must **pass** every test. `pnpm puzzles:check` proves this for every
puzzle, and CI blocks any PR that breaks it.

## Adding a puzzle

1. Create `puzzles/<language>/<level>/<id>/`, e.g.
   `puzzles/typescript/easy/paginate/`. `<id>` is kebab-case and unique across
   all puzzles.
2. Add the four files below.
3. Run `pnpm puzzles:check` until it is green.
4. Run `pnpm puzzles:build` and commit `lib/puzzles/generated/index.ts` with
   the puzzle.

## Files

| File          | What it holds                                         |
| ------------- | ----------------------------------------------------- |
| `puzzle.json` | Metadata, see below                                   |
| `buggy.<ext>` | The code players start with                           |
| `fix.<ext>`   | The reference fix: the buggy code with the bugs fixed |
| `tests.<ext>` | Tests that fail on the buggy code and pass on the fix |

`<ext>` is `js`, `ts` or `py`. No other files are allowed in the folder.

### `puzzle.json`

```json
{
  "id": "paginate",
  "title": "Paginate a list",
  "language": "typescript",
  "level": "easy",
  "description": "paginate(items, page, perPage) returns the items on the given page. Pages start at 1.",
  "hint": "Work out by hand where page 1 should start.",
  "bugCount": 1,
  "timeLimitSec": 180,
  "basePoints": 100,
  "tags": ["off-by-one", "arrays"]
}
```

| Field          | Rule                                                        |
| -------------- | ----------------------------------------------------------- |
| `id`           | Kebab-case, same as the folder name, unique                 |
| `title`        | Short, shown in lists                                       |
| `language`     | `javascript`, `typescript` or `python`; same as the folder  |
| `level`        | `easy`, `medium` or `hard`; same as the folder              |
| `description`  | What the code **should** do, so the player can spot the gap |
| `hint`         | Shown when the player asks for it                           |
| `bugCount`     | Number of separate bugs, 1–5                                |
| `timeLimitSec` | Easy 180, Medium 300, Hard 480                              |
| `basePoints`   | Easy 100, Medium 200, Hard 300                              |
| `tags`         | At least one kebab-case tag, e.g. `off-by-one`, `async`     |

The JSON Schema in `puzzle.schema.json` gives editors autocomplete; the
checker's rules live in `lib/puzzles/schema.ts`.

### Size

Lines of code in `buggy.*` **and** `fix.*`, blank lines not counted (comments
count):

| Level  | Lines |
| ------ | ----- |
| easy   | 5–15  |
| medium | 15–40 |
| hard   | 40–80 |

## Writing the code and tests

The code and the tests run as one script, code first, so the tests can call
anything the code declares. Code is a plain script: no `import`/`export`, and
do not declare the same name in both files.

JavaScript and TypeScript tests use the built-in harness:

```js
test("returns the first page", () => {
  expect(paginate(["a", "b", "c"], 1, 2)).toEqual(["a", "b"]);
});
test("async code works too", async () => {
  expect(await load()).toBe("done");
});
```

Matchers: `toBe` (`Object.is`), `toEqual` (deep), `toThrow(text?)`. See
`docs/ARCHITECTURE.md` for the full harness behaviour. Python puzzles arrive
with the Python runner (TB-19 task 6).

## What makes a good puzzle

- **One realistic bug per `bugCount`.** Off-by-one, a wrong comparison, a
  missing `await`, a mutated argument: mistakes people really make. No typos,
  no syntax errors (the checker rejects buggy code that does not run), no
  trick questions.
- **The fix is small.** Fixing a bug should change a line or two, not
  rewrite the function. Keep `fix.*` identical to `buggy.*` everywhere else.
- **The description is enough.** A player who reads it and the tests should
  know what correct looks like without guessing.
- **The hint points, it does not solve.** "Check which elements the loop
  visits" beats "change `i = 1` to `i = 0`".
- **Every bug fails a test.** With `bugCount: 2`, fixing only one bug should
  still leave a test failing. Give each test a name that says what it checks.
- **Some tests pass on the buggy code.** That tells the player which part
  already works and narrows the search.
- **Deterministic tests.** No randomness, current time, network or file
  system. Runs time out after 5 seconds, so keep loops and timers small. The
  network is blocked in the sandbox anyway.
- **Readable code.** Clear names, a one-line comment saying what the function
  does, and the repo's usual formatting (Prettier formats JS and TS puzzle
  files).
