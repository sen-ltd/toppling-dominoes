// Markdown tables for the README and the articles, and src/findings.json for the
// demo's side panel, read from runs/ (nothing is copied by hand).
//   node tools/report.mts [LR-N] [LRE-N]     e.g. node tools/report.mts 19 13
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const lrN = Number(process.argv[2] ?? 19);
const lreN = Number(process.argv[3] ?? 13);
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const lines = (f: string) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const sec = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
const n = (x: number) => x.toLocaleString('en');

const paper = read('runs/paper.json');
const LR = read(`runs/sweep-LR-${lrN}.json`);
const LRE = read(`runs/sweep-LRE-${lreN}.json`);
const sum = (s: { alphabet: string }) => lines(`runs/sweep-${s.alphabet}-${s.alphabet === 'LR' ? lrN : lreN}.jsonl`);

for (const s of [LRE, LR]) {
  console.log(`\n## Every ${s.alphabet} row up to length ${s.N}\n`);
  console.log('| length | rows | new values | numbers | hot | infinitesimal | time |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of sum(s)) console.log(`| ${r.n} | ${n(r.rows)} | ${n(r.newValues)} | ${r.numbers} | ${n(r.hot)} | ${n(r.infinitesimal)} | ${sec(r.ms)} |`);
  console.log(`\n${n(s.distinctValues)} distinct values; whole sweep ${s.seconds.toFixed(0)} s`);
}

type Status = 'ok' | 'no' | 'info';
const items: { status: Status; title: string; detail: string }[] = [];
const add = (status: Status, title: string, detail: string) => items.push({ status, title, detail });
const allOk = (c: { failures: string[] }) => c.failures.length === 0;
const rowsTotal = (s: { checks: { lemma1: { checked: number } } }) => s.checks.lemma1.checked;

add(paper.passed === paper.total ? 'ok' : 'no', 'Figures and named rows',
  `${paper.passed} / ${paper.total} items, e.g. LRRL = ↑, LRRLRRL = ⧾(1/2), LRLRE = *3. Figure 1 (the exercise) = ${paper.items.find((i: { id: string }) => i.id === 'fig1-exercise').got}.`);
const lemma1 = allOk(LRE.checks.lemma1) && allOk(LR.checks.lemma1) && allOk(LRE.checks.search) && allOk(LR.checks.search);
add(lemma1 ? 'ok' : 'no', 'Lemma 1: the ends decide who wins',
  `${n(rowsTotal(LRE))} rows of length ≤ ${LRE.N} and ${n(rowsTotal(LR))} blue/red rows of length ≤ ${LR.N}, each also checked by a plain win/lose search.`);
const t10 = LRE.checks.thm10.checked + LR.checks.thm10.checked;
add(allOk(LRE.checks.thm10) && allOk(LR.checks.thm10) ? 'ok' : 'no', 'Theorem 10: f(G) = 1:G',
  `${n(LRE.checks.thm10.checked)} rows G with f(G) of length ≤ ${LRE.N} (any colours) and ${n(LR.checks.thm10.checked)} with f(G) blue/red of length ≤ ${LR.N}.`);
void t10;
add(LRE.thm16.failures.length === 0 && LR.thm16.failures.length === 0 ? 'ok' : 'no', 'Theorem 16: one row per number, a palindrome',
  `${LRE.thm16.numbers} numbers among rows of length ≤ ${LRE.N}, ${LR.thm16.numbers} among blue/red rows of length ≤ ${LR.N}; each taken by exactly one row.`);
const c22 = [...LRE.conj22, ...LR.conj22];
const c22bad = c22.filter((c: { count: number }) => c.count !== 1);
add(c22bad.length === 0 ? 'ok' : 'no', 'Theorem 21 and Conjecture 22: tinies',
  `R L x L R = ⧿(x) and nothing else is: ${LRE.conj22.length} tinies/minies fit in length ≤ ${LRE.N} (any colours), ${LR.conj22.length} in blue/red length ≤ ${LR.N}. The paper went to 15.`);
const t29 = LR.thm29.filter((t: { ok: boolean }) => !t.ok);
add(t29.length === 0 ? 'ok' : 'no', 'Theorem 29: *m has m blue/red forms',
  `*1…*${LR.thm29[LR.thm29.length - 1].m}: every blue/red row of length ≤ ${LR.N} equal to *m is (LR)^a (RL)^m (LR)^a or its reverse, and every such row that fits is found.`);
add(allOk(LRE.checks.lemma30) && allOk(LRE.checks.lemma31) && allOk(LR.checks.lemma30) && allOk(LR.checks.lemma31) ? 'ok' : 'no',
  'Lemmas 30–31: shape of infinitesimals',
  `${n(LRE.checks.lemma31.checked)} infinitesimal rows (any colours, ≤ ${LRE.N}): the first player can always reach a nimber, and every other move can be answered by one.`);
add('info', 'Theorem 32: atomic weight 0, ±1', 'Not recomputed: these infinitesimals are not all-small, and the paper only sketches the substitution that makes the atomic-weight recursion apply.');
add(LR.conj33.lrRows === 0 ? 'ok' : 'no', 'Conjecture 33: {1 | 0, {0 | −1}} needs green',
  `No blue/red row of length ≤ ${LR.N} has this value; with green it is LERE and ${LRE.conj33.count - 1} other rows of length ≤ ${LRE.N}.`);
add(allOk(LRE.checks.conj34) && allOk(LR.checks.conj34) ? 'ok' : 'no', 'Conjecture 34: x L y > x y',
  `${n(LRE.checks.conj34.checked + LR.checks.conj34.checked)} insertions, strictly greater every time.`);
add(LR.conj35.failures.length === 0 ? 'ok' : 'no', 'Conjecture 35: blue/red palindromes are unique',
  `${n(LR.conj35.checked)} palindromes of length ≤ ${LR.N}; no other blue/red row shares a value with one.`);
const f = LR.forms;
add(f.thm36.strict.valueOk === f.thm36.strict.rows && f.conj37.strict.valueOk + f.conj37.ties.valueOk === f.conj37.strict.rows + f.conj37.ties.rows
  && f.conj38.strict.valueOk + f.conj38.ties.valueOk === f.conj38.strict.rows + f.conj38.ties.rows ? 'ok' : 'no',
  'Theorem 36, Conjectures 37–38', `{a | b} = a L R b: ${n(f.conj37.strict.rows + f.conj37.ties.rows)} rows; {a ‖ b | c} = a L R c R L b: ${n(f.conj38.strict.rows + f.conj38.ties.rows)} rows (length ≤ ${LR.N}); all equal and unique up to reversal.`);
const c39 = f.conj39;
const c39bad = c39.strict.rows + c39.ties.rows - c39.strict.valueOk - c39.ties.valueOk;
const badPatterns = Object.entries(c39.byTies).filter(([, x]) => (x as { valueOk: number; rows: number }).valueOk < (x as { rows: number }).rows).map(([k]) => k);
add(c39bad === 0 ? 'ok' : 'no', 'Conjecture 39: {a | b ‖ c | d}',
  `b R L a L R d R L c holds in all ${n(c39.strict.rows + c39.ties.rows - c39bad)} cases with b > c but fails in all ${n(c39bad)} with b = c (${badPatterns.join(', ')}): there {a | b ‖ b | d} is just the number b.`);
const d2 = LRE.day2 as { game: string; rows: number }[];
const missing = d2.filter((d) => d.rows === 0).map((d) => d.game);
add('info', 'Conjecture 40: some games never occur', `${d2.length - missing.length} of the ${d2.length} games born by day 2 appear in rows of length ≤ ${LRE.N}; missing: ${missing.join(', ')}.`);
add('info', 'Blue/red rows almost never share a value', `Up to reversal, only ${LR.shared.values} values of blue/red rows of length ≤ ${LR.N} are taken by two different rows, ${LR.shared.nimbers} of them nimbers (Theorem 29).`);

console.log(`\n## The paper\n`);
for (const i of items) console.log(`- ${i.status === 'ok' ? '✓' : i.status === 'no' ? '✗' : 'ℹ'} **${i.title}** ${i.detail}`);
console.log('\n## Conjecture 39 by ties\n');
console.log('| pattern | rows | value as claimed | claimed game is a number |');
console.log('|---|---|---|---|');
for (const [k, x] of Object.entries(c39.byTies) as [string, { rows: number; valueOk: number; claimedIsNumber: number }][]) {
  console.log(`| ${k} | ${x.rows} | ${x.valueOk} | ${x.claimedIsNumber} |`);
}
console.log('\nfirst failures:\n' + c39.ties.valueFailures.slice(0, 5).map((s: string) => `- ${s}`).join('\n'));
console.log('\n## Shared values (blue/red, up to reversal)\n');
console.log(JSON.stringify(LR.shared, null, 1));
console.log('\n## Day 2\n');
for (const d of LRE.day2) console.log(`- ${d.game}: ${d.rows} rows${d.shortest !== null ? `, shortest ${d.shortest || '∅'}` : ''}`);

if (!existsSync('src')) throw new Error('run from the repository root');
writeFileSync('src/findings.json', JSON.stringify({
  items,
  footer: `Every row of blue, red and green up to length ${LRE.N} (${n(rowsTotal(LRE))} rows) and every blue/red row up to length ${LR.N} (${n(rowsTotal(LR))} rows): node tools/verify.mts sweep.`,
}, null, 1) + '\n');
console.log('\nwrote src/findings.json');
