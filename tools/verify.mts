// Recompute every checkable claim of Fink, Nowakowski, Siegel and Wolfe,
// "Toppling Conjectures", Games of No Chance 4, MSRI Publications 63 (2015) 65–76.
//
//   node tools/verify.mts                the figures and named positions → runs/paper.json
//   node tools/verify.mts sweep LRE 12   every row of length ≤ 12 over L, R, E → runs/sweep-LRE-12.json
//   node tools/verify.mts sweep LR 18    every LR row of length ≤ 18            → runs/sweep-LR-18.json
//
// A sweep values every row once (rows are visited by length, so every option is
// already known) and checks each theorem or conjecture that quantifies over rows.
// Progress per length goes to runs/sweep-<alphabet>-<N>.jsonl as it happens.
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import {
  Valuer, Searcher, rows, f, fInverse, ordinalOne, numberRow, minyRow, tinyRow, nimberRow, outcomeFromEnds,
  isPalindrome, reverse, options, moves, type Player,
} from '../src/toppling.ts';
import {
  type GameId, ZERO, name, outcome, make, lt, numberGame, nimber, isNumber, numberValue, stops, gameCount,
  UP, cacheSizes, leftOptions, rightOptions,
} from '../src/cgt.ts';

mkdirSync('runs', { recursive: true });
const mode = process.argv[2] ?? 'paper';
const v = new Valuer();

interface Item { id: string; where: string; claim: string; got: string; ok: boolean; note?: string }
const items: Item[] = [];
function check(id: string, where: string, claim: string, ok: boolean, got: string, note?: string): void {
  items.push({ id, where, claim, got, ok, ...(note ? { note } : {}) });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} ${where}: ${claim} → ${got}${note ? ` (${note})` : ''}`);
}

const miny = (x: number) => make([make([numberGame(x)], [ZERO])], [ZERO]); // {x | 0 || 0}
const tiny = (x: number) => make([ZERO], [make([ZERO], [numberGame(-x)])]); // {0 || 0 | −x}
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : `${x * 2 ** 20}/2^20`.replace(/^(-?\d+)\/2\^20$/, (_, m) => {
  let num = Number(m);
  let d = 2 ** 20;
  while (num % 2 === 0) { num /= 2; d /= 2; }
  return `${num}/${d}`;
}));

// ---------------------------------------------------------------------------
// Named positions: the figures, transcribed from the PDF (black = L, white = R, gray = E)
// ---------------------------------------------------------------------------

function paper(): void {
  const named: [string, string, string, GameId][] = [
    ['fig2-5', 'Figure 2', 'LLLLL = 5', numberGame(5)],
    ['fig2-half', 'Figure 2', 'LRL = 1/2', numberGame(1 / 2)],
    ['fig2-quarter', 'Figure 2', 'LRLRL = 1/4', numberGame(1 / 4)],
    ['fig2-eighth', 'Figure 2', 'LRLRLRL = 1/8', numberGame(1 / 8)],
    ['fig2-star5', 'Figure 2', 'EEEEE = *5', nimber(5)],
    ['fig2-up', 'Figure 2', 'LRRL = ↑', UP],
    ['fig2-tiny1', 'Figure 2', 'LRRRL = ⧾(1)', tiny(1)],
    ['fig2-tiny2', 'Figure 2', 'LRRRRL = ⧾(2)', tiny(2)],
    ['fig2-tinyhalf', 'Figure 2', 'LRRLRRL = ⧾(1/2)', tiny(1 / 2)],
    ['fig2-star3', 'Figure 2', 'LRLRE = *3', nimber(3)],
    ['conj33-form', 'Conjecture 33', 'LERE = {1 | 0, {0 | −1}}', make([numberGame(1)], [ZERO, make([ZERO], [numberGame(-1)])])],
  ];
  for (const [id, where, claim, want] of named) {
    const s = claim.split(' ')[0];
    check(id, where, claim, v.value(s) === want, name(v.value(s)));
  }

  // §1: the Left options of LRLR are A = RLR, B = (empty), C = R, D = LR
  const lo = moves('LRLR', 'L').map((m) => m.to || '∅');
  check('sec1-options', '§1 p.65', 'Left options of LRLR: A = RLR, B = ∅, C = R, D = LR',
    lo.join(' ') === 'RLR ∅ R LR', lo.join(' '));

  // Exercise: the value of Figure 1
  const fig1 = 'LRLRLLRLRL';
  check('fig1-exercise', 'Figure 1 (exercise)', `${fig1} = ?`, true, name(v.value(fig1)), 'the paper leaves it as an exercise');

  // Definition 9's example
  check('def9-example', 'Definition 9', 'f(RRLLRL) = LRLRLLLRLL', f('RRLLRL') === 'LRLRLLLRLL', f('RRLLRL'));

  // Lemma 23 and Lemma 25 directly, for m ≤ 12 (rows up to length 68)
  let bad = 0;
  for (let m = 0; m <= 12; m++) if (v.value('LR'.repeat(m)) !== nimber(m)) bad++;
  check('lemma-23', 'Lemma 23', '(LR)^m = *m, m = 0…12', bad === 0, `${bad} exceptions`);
  bad = 0;
  let n25 = 0;
  for (let m = 1; m <= 7; m++) for (let a = 0; a < m; a++) { n25++; if (v.value(nimberRow(m, a)) !== nimber(m)) bad++; }
  check('lemma-25', 'Lemma 25', `(LR)^a (RL)^m (LR)^a = *m, 0 ≤ a < m ≤ 7 (${n25} rows, up to length 38)`, bad === 0, `${bad} exceptions`);

  // Theorem 10 on long rows: f(G) = 1:G for a few G whose f(G) is beyond the sweeps
  bad = 0;
  const longs = ['LRLRLLRLRL', 'EREELRRELL', 'RRRLLLEEE', 'LERELERELERE'];
  for (const s of longs) if (v.value(f(s)) !== ordinalOne(v.value(s))) bad++;
  check('thm-10-long', 'Theorem 10', `f(G) = 1:G for ${longs.join(', ')}`, bad === 0, `${bad} exceptions`);

  // Theorem 16 constructively: numberRow(x) = x for every dyadic x = k/2^j, |x| ≤ 4, j ≤ 4
  bad = 0;
  let nn = 0;
  for (let k = -64; k <= 64; k++) {
    const x = k / 16;
    nn++;
    const s = numberRow(x);
    if (v.value(s) !== numberGame(x) || !isPalindrome(s)) bad++;
  }
  check('thm-16-constructive', 'Theorem 10, Corollary 17', `numberRow(x) = x and is a palindrome, x = k/16, |x| ≤ 4 (${nn} numbers)`, bad === 0, `${bad} exceptions`);

  // Theorem 21: R L x L R = ⧿x for the same numbers x > 0
  bad = 0;
  nn = 0;
  for (let k = 1; k <= 64; k++) {
    const x = k / 16;
    nn++;
    if (v.value(minyRow(x)) !== miny(x) || v.value(tinyRow(x)) !== tiny(x)) bad++;
  }
  check('thm-21', 'Theorem 21', `R L x L R = ⧿x and L R (−x) R L = ⧾x, x = k/16 ≤ 4 (${nn} numbers)`, bad === 0, `${bad} exceptions`);

  const passed = items.filter((i) => i.ok).length;
  writeFileSync('runs/paper.json', JSON.stringify({ passed, total: items.length, items }, null, 2) + '\n');
  console.log(`${passed} / ${items.length}`);
}

// ---------------------------------------------------------------------------
// Sweeps over every row
// ---------------------------------------------------------------------------

interface Seen { count: number; classes: number; rows: string[] }

function sweep(alphabet: string, N: number): void {
  const tag = `sweep-${alphabet}-${N}`;
  const jsonl = `runs/${tag}.jsonl`;
  writeFileSync(jsonl, '');
  const se = new Searcher();
  const index = new Map<GameId, Seen>();
  const nimberIds = new Map<GameId, number>();
  for (let m = 0; m <= 40; m++) nimberIds.set(nimber(m), m);
  const isNimber = (g: GameId) => nimberIds.has(g);

  const counter = () => ({ checked: 0, failures: [] as string[] });
  const c = {
    lemma1: counter(), search: counter(), thm10: counter(), conj34: counter(), lemma14: counter(),
    lemma30: counter(), lemma31: counter(),
  };
  const fail = (k: keyof typeof c, msg: string) => { if (c[k].failures.length < 10) c[k].failures.push(msg); };
  const t0 = Date.now();

  for (let n = 0; n <= N; n++) {
    const t = Date.now();
    let numbers = 0;
    let hot = 0;
    let infinitesimal = 0;
    let newValues = 0;
    let count = 0;
    for (const s of rows(n, alphabet)) {
      count++;
      const g = v.value(s);
      let seen = index.get(g);
      if (!seen) { seen = { count: 0, classes: 0, rows: [] }; index.set(g, seen); newValues++; }
      seen.count++;
      if (s <= reverse(s)) {
        seen.classes++; // rows counted up to reversal
        if (seen.rows.length < 6) seen.rows.push(s);
      }

      // Lemma 1, and the engine against plain search
      const o = outcome(g);
      c.lemma1.checked++;
      if (o !== outcomeFromEnds(s)) fail('lemma1', `${s}: ${o}`);
      c.search.checked++;
      if (o !== se.outcome(s)) fail('search', `${s}: engine ${o}, search ${se.outcome(s)}`);

      // Theorem 10: every row in the image of f equals 1:(its preimage)
      const pre = fInverse(s);
      if (pre !== null) {
        c.thm10.checked++;
        if (g !== ordinalOne(v.value(pre))) fail('thm10', `f(${pre}) = ${s}`);
      }

      // Conjecture 34: x L y > x y
      for (let k = 0; k < n; k++) {
        if (s[k] !== 'L') continue;
        const xy = s.slice(0, k) + s.slice(k + 1);
        c.conj34.checked++;
        if (!lt(v.value(xy), g)) fail('conj34', `${s.slice(0, k)}·L·${s.slice(k + 1)} vs ${xy}`);
      }

      const [ls, rs] = stops(g);
      if (isNumber(g)) {
        numbers++;
        // Lemma 14: a number has no two adjacent non-blue (resp. non-red) dominoes
        c.lemma14.checked++;
        const x = numberValue(g);
        if ((x > 0 && /[RE]{2}/.test(s)) || (x < 0 && /[LE]{2}/.test(s))) fail('lemma14', s);
      } else if (ls > rs) hot++;

      if (ls === 0 && rs === 0) {
        infinitesimal++;
        // Lemma 30 (and its mirror image for rows beginning in R)
        for (const [p, q] of [['L', 'R'], ['R', 'L']] as const) {
          if (s[0] !== p) continue;
          c.lemma30.checked++;
          const re = new RegExp(`^(${p}${q})*($|[E${q}])`);
          if (!re.test(s)) fail('lemma30', s);
        }
        // Lemma 31
        if (s !== '') {
          c.lemma31.checked++;
          for (const p of ['L', 'R'] as Player[]) {
            const q: Player = p === 'L' ? 'R' : 'L';
            const opts = options(s, p);
            const toNimber = opts.some((t) => isNimber(v.value(t)));
            const answered = opts.every((t) => isNimber(v.value(t)) || options(t, q).some((u) => isNimber(v.value(u))));
            if (!toNimber || !answered) { fail('lemma31', `${s} (${p} first)`); break; }
          }
        }
      }
    }
    const row = {
      n, rows: count, newValues, distinctSoFar: index.size, numbers, hot, infinitesimal,
      ms: Date.now() - t, games: gameCount(), le: cacheSizes().le,
    };
    appendFileSync(jsonl, JSON.stringify(row) + '\n');
    console.log(JSON.stringify(row));
  }

  // Theorem 16 and Corollary 17: one row per number, a palindrome, the one numberRow builds
  const numberRows = [...index.entries()].filter(([g]) => isNumber(g)).map(([g, s]) => ({ x: numberValue(g), ...s }));
  numberRows.sort((a, b) => a.x - b.x);
  const thm16bad = numberRows.filter((r) => r.count !== 1 || !isPalindrome(r.rows[0]) || r.rows[0] !== numberRow(r.x));

  // Theorem 21 / Conjecture 22: ⧿x and ⧾x appear exactly once (only checkable where R L x L R fits)
  const conj22: { x: number; row: string; count: number; rows: string[] }[] = [];
  for (const r of numberRows) {
    if (r.x <= 0) continue;
    for (const [row, g] of [[minyRow(r.x), miny(r.x)], [tinyRow(r.x), tiny(r.x)]] as const) {
      if (row.length > N || ![...row].every((ch) => alphabet.includes(ch))) continue;
      const seen = index.get(g);
      conj22.push({ x: r.x, row, count: seen?.count ?? 0, rows: seen?.rows ?? [] });
    }
  }

  // Theorem 29: the LR rows equal to *m are exactly (LR)^a (RL)^m (LR)^a and reversals, a < m
  const thm29: { m: number; found: number; expected: number; ok: boolean; rows: string[] }[] = [];
  for (let m = 1; m <= 40; m++) {
    const seen = index.get(nimber(m));
    const lrCount = alphabet === 'LR' ? (seen?.count ?? 0) : NaN;
    const expect = new Set<string>();
    for (let a = 0; a < m; a++) {
      const r = nimberRow(m, a);
      if (r.length <= N) { expect.add(r); expect.add(reverse(r)); }
    }
    if (expect.size === 0 && !seen) break;
    if (alphabet === 'LR') thm29.push({ m, found: lrCount, expected: expect.size, ok: lrCount === expect.size && (seen?.rows ?? []).every((r) => expect.has(r)), rows: seen?.rows ?? [] });
    else thm29.push({ m, found: seen?.count ?? 0, expected: expect.size, ok: true, rows: seen?.rows ?? [] });
  }

  // Conjecture 35: an LR palindrome's value is not taken by any other LR row
  const conj35 = { checked: 0, failures: [] as string[] };
  const lrIndex = new Map<GameId, number>();
  if (alphabet === 'LRE') {
    // count only the LR rows for the LR-specific claim
    for (let n = 0; n <= N; n++) for (const s of rows(n, 'LR')) lrIndex.set(v.value(s), (lrIndex.get(v.value(s)) ?? 0) + 1);
  }
  const lrCount = (g: GameId) => (alphabet === 'LR' ? index.get(g)!.count : lrIndex.get(g)!);
  const palinShared: string[] = [];
  for (let n = 0; n <= N; n++) {
    for (const s of rows(n, 'LR')) {
      if (!isPalindrome(s)) continue;
      conj35.checked++;
      const g = v.value(s);
      if (lrCount(g) !== 1 && conj35.failures.length < 10) conj35.failures.push(`${s} = ${name(g)} also ${index.get(g)!.rows.filter((r) => r !== s && !/E/.test(r)).join(', ')}`);
      if (alphabet === 'LRE' && index.get(g)!.count > 1 && palinShared.length < 10) palinShared.push(`${s} = ${index.get(g)!.rows.join(', ')}`);
    }
  }

  // Conjecture 33: {1 | 0, {0 | −1}} in LR rows?
  const c33 = make([numberGame(1)], [ZERO, make([ZERO], [numberGame(-1)])]);
  const conj33 = { lrRows: alphabet === 'LR' ? (index.get(c33)?.count ?? 0) : (lrIndex.get(c33) ?? 0), rows: index.get(c33)?.rows ?? [], count: index.get(c33)?.count ?? 0 };

  // Theorem 36 and Conjectures 37–39 on every combination of number rows that fits.
  // Each candidate records whether the row has the claimed value, and whether no
  // other row (LR rows only / any row) has it, up to reversal; ties among a ≥ b ≥ c ≥ d are kept apart.
  interface Form { claim: string; row: string; strict: boolean; ties: string; got: string; want: string; valueOk: boolean; uniqueLR: boolean; uniqueAll: boolean }
  const forms: Record<string, Form[]> = { thm36: [], conj37: [], conj38: [], conj39: [] };
  const fits = (s: string) => s.length <= N && [...s].every((ch) => alphabet.includes(ch));
  const lrOnly = (g: GameId) => (alphabet === 'LR' ? (index.get(g)?.count ?? 0) : (lrIndex.get(g) ?? 0));
  const mirrors = (row: string) => (isPalindrome(row) ? 1 : 2);
  // which of the ≥ between consecutive parameters are equalities, e.g. "a>b=c>d"
  const tiePattern = (ps: number[]) => ps.map((p, i) => (i === 0 ? '' : ps[i - 1] === p ? '=' : '>') + 'abcd'[i]).join('');
  const wantIds = new Map<Form, GameId>();
  const parseWant = (f: Form) => wantIds.get(f)!;
  function form(kind: string, claim: string, row: string, want: GameId, ps: number[]): void {
    if (!fits(row)) return;
    const g = v.value(row);
    const ties = tiePattern(ps);
    const rec: Form = {
      claim, row, strict: !ties.includes('='), ties, got: name(g), want: name(want), valueOk: g === want,
      // unique up to reversal: the row and its mirror image are the only rows of that value
      uniqueLR: !/E/.test(row) && lrOnly(want) === mirrors(row), uniqueAll: index.get(want)?.count === mirrors(row),
    };
    wantIds.set(rec, want);
    forms[kind].push(rec);
  }
  const nums = numberRows.map((r) => r.x);
  const rowMemo = new Map(nums.map((x) => [x, numberRow(x)]));
  const rowOf = (x: number) => rowMemo.get(x)!;
  const len = (x: number) => rowOf(x).length;
  for (const x of nums) {
    if (x === 0) continue;
    const g = numberGame(x);
    const [gl, gr] = [leftOptions(g), rightOptions(g)];
    if (gl.length === 1 && gr.length === 1) {
      const [a, b] = [numberValue(gl[0]), numberValue(gr[0])];
      form('thm36', `${fmt(x)} = {${fmt(a)} | ${fmt(b)}}`, rowOf(a) + 'LR' + rowOf(b), g, [a, b]);
    }
  }
  const xs = [...nums].sort((a, b) => b - a);
  for (const a of xs) for (const b of xs) {
    if (b > a || len(a) + len(b) + 2 > N) continue;
    form('conj37', `{${fmt(a)} | ${fmt(b)}}`, rowOf(a) + 'LR' + rowOf(b), make([numberGame(a)], [numberGame(b)]), [a, b]);
    for (const c3 of xs) {
      if (c3 > b || len(a) + len(b) + len(c3) + 4 > N) continue;
      form('conj38', `{${fmt(a)} || ${fmt(b)} | ${fmt(c3)}}`, rowOf(a) + 'LR' + rowOf(c3) + 'RL' + rowOf(b),
        make([numberGame(a)], [make([numberGame(b)], [numberGame(c3)])]), [a, b, c3]);
      for (const d of xs) {
        if (d > c3 || len(a) + len(b) + len(c3) + len(d) + 6 > N) continue;
        form('conj39', `{${fmt(a)} | ${fmt(b)} || ${fmt(c3)} | ${fmt(d)}}`, rowOf(b) + 'RL' + rowOf(a) + 'LR' + rowOf(d) + 'RL' + rowOf(c3),
          make([make([numberGame(a)], [numberGame(b)])], [make([numberGame(c3)], [numberGame(d)])]), [a, b, c3, d]);
      }
    }
  }
  const formSummary = Object.fromEntries(Object.entries(forms).map(([k, fs]) => {
    const part = (xs: Form[]) => ({
      rows: xs.length, valueOk: xs.filter((f) => f.valueOk).length,
      uniqueLR: xs.filter((f) => f.valueOk && f.uniqueLR).length, uniqueAll: xs.filter((f) => f.valueOk && f.uniqueAll).length,
      valueFailures: xs.filter((f) => !f.valueOk).slice(0, 12).map((f) => `${f.row}: claimed ${f.claim} (= ${f.want}), is ${f.got}`),
      notUniqueLR: xs.filter((f) => f.valueOk && !f.uniqueLR).slice(0, 6).map((f) => `${f.row} = ${f.got}: also ${(index.get(v.value(f.row))?.rows ?? []).filter((r) => r !== f.row && r !== reverse(f.row) && !/E/.test(r)).join(', ')}`),
    });
    const byTies = Object.fromEntries([...new Set(fs.map((f) => f.ties))].sort().map((t) => {
      const xs = fs.filter((f) => f.ties === t);
      return [t, {
        rows: xs.length, valueOk: xs.filter((f) => f.valueOk).length, uniqueLR: xs.filter((f) => f.valueOk && f.uniqueLR).length,
        claimedIsNumber: xs.filter((f) => isNumber(parseWant(f))).length,
      }];
    }));
    return [k, { strict: part(fs.filter((f) => f.strict)), ties: part(fs.filter((f) => !f.strict)), byTies }];
  }));
  // Conjecture 40: which of the 22 games born by day 2 appear?
  const day1 = [ZERO, nimber(1), numberGame(1), numberGame(-1)];
  const subsets = (xs: GameId[]) => xs.reduce<GameId[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);
  const day2 = [...new Set(subsets(day1).flatMap((L) => subsets(day1).map((R) => make(L, R))))];
  const day2Seen = day2.map((g) => ({ game: name(g), rows: index.get(g)?.count ?? 0, shortest: index.get(g)?.rows[0] ?? null }));

  // Values taken by two or more rows that are not mirror images of each other
  const shared = [...index.entries()].filter(([, s]) => s.classes > 1);
  const sharedSummary = {
    values: shared.length,
    nimbers: shared.filter(([g]) => nimberIds.has(g)).length,
    examples: shared.filter(([g]) => !nimberIds.has(g)).sort((a, b) => a[1].rows[0].length - b[1].rows[0].length)
      .slice(0, 12).map(([g, s]) => `${name(g)}: ${s.rows.join(', ')}${s.classes > s.rows.length ? ', …' : ''} (${s.classes} up to reversal)`),
    lengths: Object.fromEntries([...new Set(shared.map(([, s]) => s.rows[0].length))].sort((a, b) => a - b)
      .map((l) => [l, shared.filter(([, s]) => s.rows[0].length === l).length])),
  };
  const out = {
    alphabet, N, seconds: (Date.now() - t0) / 1000, distinctValues: index.size, games: gameCount(),
    checks: c,
    thm16: { numbers: numberRows.length, failures: thm16bad.slice(0, 10).map((r) => `${fmt(r.x)}: ${r.count} rows ${r.rows.join(', ')}`), list: numberRows.map((r) => [fmt(r.x), r.rows[0]]) },
    conj22, thm29, conj35: { ...conj35, palindromeValueAlsoWithGreen: palinShared }, conj33, forms: formSummary, day2: day2Seen, shared: sharedSummary,
  };
  writeFileSync(`runs/${tag}.json`, JSON.stringify(out, null, 1) + '\n');
  console.log(`done ${tag} in ${out.seconds} s`);
}

if (mode === 'paper') paper();
else if (mode === 'sweep') sweep(process.argv[3] ?? 'LRE', Number(process.argv[4] ?? 10));
else throw new Error(`unknown mode ${mode}`);
