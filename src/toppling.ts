// Toppling Dominoes (Albert, Nowakowski and Wolfe, Lessons in Play).
//
// A position is a row of dominoes written west to east as a string over
//   L  a Left (blue / black) domino
//   R  a Right (red / white) domino
//   E  a domino Either player may topple (green / gray)
// A move topples one of your dominoes west or east; it falls together with
// every domino on that side. Toppling domino i west leaves s[i+1..], east
// leaves s[..i-1], so every position reachable from s is a substring of s.

import { type GameId, ZERO, make, simplestBetween, leftOptions, rightOptions } from './cgt.ts';

export type Player = 'L' | 'R';
export type Dir = 'W' | 'E';
export interface Move { i: number; dir: Dir; to: string }

export const ROW_RE = /^[LRE]*$/;

export const canTopple = (d: string, p: Player): boolean => d === p || d === 'E';

export function moves(s: string, p: Player): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < s.length; i++) {
    if (!canTopple(s[i], p)) continue;
    out.push({ i, dir: 'W', to: s.slice(i + 1) });
    out.push({ i, dir: 'E', to: s.slice(0, i) });
  }
  return out;
}

/** The distinct positions one move away. */
export function options(s: string, p: Player): string[] {
  return [...new Set(moves(s, p).map((m) => m.to))];
}

/** Canonical values of rows, memoised by the row itself. */
export class Valuer {
  private memo = new Map<string, GameId>([['', ZERO]]);
  value(s: string): GameId {
    const hit = this.memo.get(s);
    if (hit !== undefined) return hit;
    const g = make(options(s, 'L').map((t) => this.value(t)), options(s, 'R').map((t) => this.value(t)));
    this.memo.set(s, g);
    return g;
  }
  get size(): number {
    return this.memo.size;
  }
}

/**
 * Who wins with plain game-tree search, no values: does the player to move win?
 * Used to check the engine's outcome classes independently of canonical forms.
 */
export class Searcher {
  private memo = new Map<string, boolean>();
  wins(s: string, p: Player): boolean {
    const k = p + s;
    const hit = this.memo.get(k);
    if (hit !== undefined) return hit;
    const q: Player = p === 'L' ? 'R' : 'L';
    let r = false;
    for (const t of options(s, p)) if (!this.wins(t, q)) { r = true; break; }
    this.memo.set(k, r);
    return r;
  }
  outcome(s: string): 'L' | 'R' | 'P' | 'N' {
    const l = this.wins(s, 'L');
    const r = this.wins(s, 'R');
    return l && r ? 'N' : l ? 'L' : r ? 'R' : 'P';
  }
}

export const reverse = (s: string): string => [...s].reverse().join('');
/** Swap the colours: the row of −G. */
export const negate = (s: string): string => s.replace(/[LR]/g, (c) => (c === 'L' ? 'R' : 'L'));
export const isPalindrome = (s: string): boolean => s === reverse(s);
export const rep = (s: string, n: number): string => s.repeat(n);

/** Definition 9: one more L in every maximal run of Ls, empty runs included. */
export const f = (s: string): string => 'L' + s.replace(/[RE]/g, (c) => c + 'L');

/** The inverse of f, or null when s is not in its image. */
export function fInverse(s: string): string | null {
  if (!s.startsWith('L')) return null;
  const runs = s.split(/[RE]/);
  if (runs.some((r) => r.length === 0)) return null;
  const seps = s.replace(/L/g, '');
  let out = runs[0].slice(1);
  for (let k = 0; k < seps.length; k++) out += seps[k] + runs[k + 1].slice(1);
  return out;
}

/** 1:G, the ordinal sum with base 1 = {0 | }: Left may also move to 0. */
const ordMemo = new Map<GameId, GameId>();
export function ordinalOne(g: GameId): GameId {
  const hit = ordMemo.get(g);
  if (hit !== undefined) return hit;
  const r = make([ZERO, ...leftOptions(g).map(ordinalOne)], rightOptions(g).map(ordinalOne));
  ordMemo.set(g, r);
  return r;
}

/** The number y with 1:y = x, for a dyadic x > 0 (Fact 7). */
export function ordinalOneInverse(x: number): number {
  if (Number.isInteger(x)) return x - 1;
  let d = 2;
  while (!Number.isInteger(x * d)) d *= 2;
  const lo = x - 1 / d;
  const hi = x + 1 / d;
  // 1:(−n) = 2^−n
  if (lo === 0) return -Math.log2(d);
  return simplestBetween(ordinalOneInverse(lo), ordinalOneInverse(hi));
}

/** The row equal to the dyadic rational x (Theorem 10 and Corollary 8). */
export function numberRow(x: number): string {
  if (x === 0) return '';
  if (x < 0) return negate(numberRow(-x));
  return f(numberRow(ordinalOneInverse(x)));
}

/** Theorem 21: R L x L R = ⧿x (miny-x); its negative L R (−x) R L = ⧾x (tiny-x). */
export const minyRow = (x: number): string => `RL${numberRow(x)}LR`;
export const tinyRow = (x: number): string => `LR${numberRow(-x)}RL`;

/** Theorem 29: (LR)^a (RL)^m (LR)^a = *m for 0 ≤ a < m. */
export const nimberRow = (m: number, a: number): string => rep('LR', a) + rep('RL', m) + rep('LR', a);

/** Lemma 1: the outcome class from the end dominoes alone. */
export function outcomeFromEnds(s: string): 'L' | 'R' | 'P' | 'N' {
  if (s === '') return 'P';
  const a = s[0];
  const b = s[s.length - 1];
  if (a === 'E' || b === 'E' || a !== b) return 'N';
  return a === 'L' ? 'L' : 'R';
}

/** All rows of length n over the given alphabet, in lexicographic order. */
export function* rows(n: number, alphabet = 'LRE'): Generator<string> {
  const k = alphabet.length;
  const total = k ** n;
  for (let idx = 0; idx < total; idx++) {
    let s = '';
    let t = idx;
    for (let j = 0; j < n; j++) {
      s = alphabet[t % k] + s;
      t = Math.floor(t / k);
    }
    yield s;
  }
}

