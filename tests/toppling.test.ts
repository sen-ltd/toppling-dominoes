import { describe, it, expect } from 'vitest';
import {
  Valuer, Searcher, moves, options, rows, f, fInverse, ordinalOne, numberRow, minyRow, tinyRow, nimberRow,
  outcomeFromEnds, isPalindrome, reverse, negate,
} from '../src/toppling.ts';
import { ZERO, UP, make, nimber, numberGame, outcome, lt, name, isNumber, numberValue } from '../src/cgt.ts';

const v = new Valuer();
const tiny = (x: number) => make([ZERO], [make([ZERO], [numberGame(-x)])]);
const miny = (x: number) => make([make([numberGame(x)], [ZERO])], [ZERO]);

describe('moves', () => {
  it('topples a prefix or a suffix (the example on p. 65)', () => {
    expect(moves('LRLR', 'L').map((m) => m.to)).toEqual(['RLR', '', 'R', 'LR']);
    expect(options('E', 'R')).toEqual(['']);
    expect(moves('LLL', 'R')).toEqual([]);
  });
});

describe('the figures', () => {
  it.each([
    ['LLLLL', numberGame(5)], ['LRL', numberGame(1 / 2)], ['LRLRL', numberGame(1 / 4)], ['LRLRLRL', numberGame(1 / 8)],
    ['EEEEE', nimber(5)], ['LRRL', UP], ['LRRRL', tiny(1)], ['LRRRRL', tiny(2)], ['LRRLRRL', tiny(1 / 2)], ['LRLRE', nimber(3)],
    ['LERE', make([numberGame(1)], [ZERO, make([ZERO], [numberGame(-1)])])],
  ])('%s', (s, g) => expect(name(v.value(s))).toBe(name(g)));
  it('Figure 1 is worth 3/8', () => expect(v.value('LRLRLLRLRL')).toBe(numberGame(3 / 8)));
});

describe('every row up to length 7', () => {
  const all = [...Array(8).keys()].flatMap((n) => [...rows(n)]);
  const se = new Searcher();
  it('Lemma 1 and plain search agree with the engine', () => {
    for (const s of all) {
      expect(outcome(v.value(s))).toBe(outcomeFromEnds(s));
      expect(se.outcome(s)).toBe(outcomeFromEnds(s));
    }
  });
  it('Theorem 10: f(G) = 1:G', () => {
    for (const s of all.filter((s) => s.length <= 4)) expect(v.value(f(s))).toBe(ordinalOne(v.value(s)));
    expect(fInverse(f('RRLLRL'))).toBe('RRLLRL');
    expect(fInverse('LRRL')).toBeNull();
  });
  it('Theorem 16: numbers are unique palindromes', () => {
    const seen = new Map<number, string[]>();
    for (const s of all) {
      const g = v.value(s);
      if (isNumber(g)) seen.set(numberValue(g), [...(seen.get(numberValue(g)) ?? []), s]);
    }
    for (const [x, rs] of seen) {
      expect(rs).toEqual([numberRow(x)]);
      expect(isPalindrome(rs[0])).toBe(true);
    }
  });
  it('Conjecture 34: x L y > x y', () => {
    for (const s of all) for (let k = 0; k < s.length; k++) {
      if (s[k] === 'L') expect(lt(v.value(s.slice(0, k) + s.slice(k + 1)), v.value(s))).toBe(true);
    }
  });
  it('mirror image and colour swap', () => {
    for (const s of all.filter((s) => s.length <= 5)) {
      expect(v.value(reverse(s))).toBe(v.value(s));
      expect(outcomeFromEnds(negate(s))).toBe({ L: 'R', R: 'L', P: 'P', N: 'N' }[outcomeFromEnds(s)]);
    }
  });
});

describe('constructions', () => {
  it('numberRow builds every k/16 up to 3', () => {
    for (let k = -48; k <= 48; k++) expect(v.value(numberRow(k / 16))).toBe(numberGame(k / 16));
  });
  it('Theorem 21: tinies and minies', () => {
    for (const x of [1 / 4, 1 / 2, 1, 3 / 2, 2]) {
      expect(v.value(minyRow(x))).toBe(miny(x));
      expect(v.value(tinyRow(x))).toBe(tiny(x));
    }
  });
  it('Lemma 23 and Theorem 29: the forms of *m', () => {
    for (let m = 0; m <= 8; m++) expect(v.value('LR'.repeat(m))).toBe(nimber(m));
    for (let m = 1; m <= 5; m++) for (let a = 0; a < m; a++) expect(v.value(nimberRow(m, a))).toBe(nimber(m));
    // exactly m forms up to reversal among LR rows of length ≤ 12
    const count = new Map<number, number>();
    for (let n = 0; n <= 12; n++) for (const s of rows(n, 'LR')) {
      for (let m = 1; m <= 6; m++) if (v.value(s) === nimber(m) && s <= reverse(s)) count.set(m, (count.get(m) ?? 0) + 1);
    }
    expect([...count.entries()].sort((a, b) => a[0] - b[0])).toEqual([[1, 1], [2, 2], [3, 2], [4, 2], [5, 1], [6, 1]]);
  });
});

describe('Conjecture 39: {a | b ‖ c | d} = b R L a L R d R L c', () => {
  const row = (a: number, b: number, c: number, d: number) => numberRow(b) + 'RL' + numberRow(a) + 'LR' + numberRow(d) + 'RL' + numberRow(c);
  const game = (a: number, b: number, c: number, d: number) =>
    make([make([numberGame(a)], [numberGame(b)])], [make([numberGame(c)], [numberGame(d)])]);
  it('holds when b > c', () => {
    expect(v.value(row(2, 1, 0, -1))).toBe(game(2, 1, 0, -1));
    expect(v.value(row(2, 1, 0, 0))).toBe(game(2, 1, 0, 0));
    expect(v.value(row(1, 1, 0, -1))).toBe(game(1, 1, 0, -1));
  });
  it('fails when b = c: the claimed game is the number b', () => {
    expect(game(2, 1, 1, 0)).toBe(numberGame(1));
    expect(v.value(row(2, 1, 1, 0))).not.toBe(numberGame(1));
    expect(row(2, 1, 1, 0)).toBe('LRLLLLRRLL');
    expect(isNumber(v.value('LRLLLLRRLL'))).toBe(false);
  });
});

describe('Conjecture 33', () => {
  it('{1 | 0, {0 | −1}} is not an LR row of length ≤ 12', () => {
    const g = v.value('LERE');
    for (let n = 0; n <= 12; n++) for (const s of rows(n, 'LR')) expect(v.value(s)).not.toBe(g);
  });
});
