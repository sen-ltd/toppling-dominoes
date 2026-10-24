// Atomic weight of an all-small game (Berlekamp–Conway–Guy, Winning Ways ch. 8;
// the form used in Albert–Grossman–Nowakowski–Wolfe, "An introduction to Clobber",
// Definition 3.8):
//
//   G0 = { aw(GL) − 2 | aw(GR) + 2 }
//
// unless G0 is an integer and G is greater than (or less than) the far star ☆.
// Then aw(G) is the largest integer n with n ⧏ every aw(GR) + 2 (when G > ☆),
// or the least integer n with n ⧐ every aw(GL) − 2 (when G < ☆).
//
// ☆ is any "remote" nimber: *m such that no position of G equals *m. A position
// that equals *m was born on day m or later, so m = birthday(G) + 1 is remote.
// Options are taken from the canonical form, and the result is memoised by id.

import {
  type GameId, ZERO, add, make, numberGame, isNumber, numberValue, le, leftOptions, rightOptions,
  nimber, birthday,
} from './cgt.ts';

const memo = new Map<GameId, GameId>();

/** G > ☆, G < ☆, or neither. */
export function farStarSide(g: GameId): 1 | -1 | 0 {
  const star = nimber(birthday(g) + 1);
  if (le(star, g)) return 1; // G ≥ *m, and G ≠ *m, so G > *m
  if (le(g, star)) return -1;
  return 0;
}

export function atomicWeight(g: GameId): GameId {
  if (g === ZERO) return ZERO;
  const hit = memo.get(g);
  if (hit !== undefined) return hit;
  const minus2 = numberGame(-2);
  const plus2 = numberGame(2);
  const AL = leftOptions(g).map((o) => add(atomicWeight(o), minus2));
  const AR = rightOptions(g).map((o) => add(atomicWeight(o), plus2));
  let r = make(AL, AR);
  if (isNumber(r) && Number.isInteger(numberValue(r)) && AL.length > 0 && AR.length > 0) {
    const side = farStarSide(g);
    if (side === 1) r = numberGame(extremeInteger(AR, true));
    else if (side === -1) r = numberGame(extremeInteger(AL, false));
  }
  memo.set(g, r);
  return r;
}

/**
 * largest = true: the largest integer n with n ⧏ x (not n ≥ x) for every x in xs.
 * largest = false: the least integer n with n ⧐ x (not n ≤ x) for every x in xs.
 */
function extremeInteger(xs: GameId[], largest: boolean): number {
  const ok = (n: number) =>
    xs.every((x) => (largest ? !le(x, numberGame(n)) : !le(numberGame(n), x)));
  // n ⧏ x holds for every n far enough below x and fails far enough above it
  let n = 0;
  if (largest) {
    if (ok(n)) { while (ok(n + 1)) n++; } else { while (!ok(n)) n--; }
  } else {
    if (ok(n)) { while (ok(n - 1)) n--; } else { while (!ok(n)) n++; }
  }
  return n;
}
