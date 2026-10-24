import './style.css';
import { Valuer, moves, ROW_RE, isPalindrome, type Move, type Player } from './toppling.ts';
import {
  type GameId, name, outcome, isNumber, numberValue, stops, formatNumber, nimber, leftOptions, rightOptions, tinyPart,
} from './cgt.ts';
import findings from './findings.json';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const svg = $<HTMLElement>('board') as unknown as SVGSVGElement;
const statusEl = $('status');
const presetSel = $<HTMLSelectElement>('presetSel');
const youSel = $<HTMLSelectElement>('youSel');
const firstSel = $<HTMLSelectElement>('firstSel');
const hintsBox = $<HTMLInputElement>('hints');
const modeBtn = $<HTMLButtonElement>('mode');
const palette = $('palette');
const rowText = $<HTMLInputElement>('rowText');

const MAX_LEN = 24;
const NS = 'http://www.w3.org/2000/svg';
const v = new Valuer();

interface Preset { id: string; label: string; row: string; first: Player }
const PRESETS: Preset[] = [
  { id: 'fig1', label: 'Figure 1 (the exercise): 3/8', row: 'LRLRLLRLRL', first: 'L' },
  { id: 'up', label: 'Figure 2: ↑', row: 'LRRL', first: 'R' },
  { id: 'tiny', label: 'Figure 2: ⧾(1/2), a tiny', row: 'LRRLRRL', first: 'R' },
  { id: 'star3', label: 'Figure 2: *3 with a green end', row: 'LRLRE', first: 'L' },
  { id: 'star3b', label: '*3 again: (LR)(RL)³(LR)', row: 'LRRLRLRLLR', first: 'L' },
  { id: 'eighth', label: '1/8, the only row worth 1/8', row: 'LRLRLRL', first: 'R' },
  { id: 'c39ok', label: 'Conjecture 39 holds: {2 | 1 ‖ 0 | −1}', row: 'LRLLLLRRRL', first: 'L' },
  { id: 'c39no', label: 'Conjecture 39 fails: b = c, and {2 | 1 ‖ 1 | 0} is just 1', row: 'LRLLLLRRLL', first: 'L' },
  { id: 'c33', label: 'Conjecture 33: {1 | 0, {0 | −1}} needs green', row: 'LERE', first: 'L' },
  { id: 'twin', label: '1*2: two LR rows that are not mirror images', row: 'LLRLLRL', first: 'L' },
  { id: 'long', label: 'A long mixed row', row: 'LRELLRERLRRELRLE', first: 'L' },
];

let initial = PRESETS[0].row;
let row = initial;
let toMove: Player = 'L';
let history: { row: string; toMove: Player }[] = [];
let you: Player = 'L';
let editing = false;
let animating = false;
let cpuTimer = 0;

const other = (p: Player): Player => (p === 'L' ? 'R' : 'L');
const who = (p: Player) => (p === 'L' ? '<strong class="blue-t">Blue</strong>' : '<strong class="red-t">Red</strong>');

/** Does the player who just moved to t win (t is played with the opponent to move)? */
function moverWins(t: string, mover: Player): boolean {
  const o = outcome(v.value(t));
  return o === 'P' || o === mover;
}

function presetOptions(): void {
  presetSel.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
}

function load(r: string, first: Player): void {
  window.clearTimeout(cpuTimer);
  initial = r;
  row = r;
  toMove = first;
  firstSel.value = first;
  history = [];
  animating = false;
  render();
  maybeCpu();
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

const W = 30;
const GAP = 22;
const H = 96;
const TOP = 52;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, String(val));
  parent.appendChild(e);
  return e;
}

function drawBoard(): void {
  svg.innerHTML = '';
  const n = row.length;
  const width = Math.max(560, 40 + n * (W + GAP));
  const height = TOP + H + 40;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const x0 = (width - (n * (W + GAP) - GAP)) / 2;
  el('rect', { class: 'ground', x: Math.min(x0 - 16, 20), y: TOP + H, width: Math.max(n * (W + GAP) - GAP + 32, width - 40), height: 6, rx: 3 }, svg);
  if (n === 0) {
    const t = el('text', { class: 'empty', x: width / 2, y: TOP + H / 2 }, svg);
    t.textContent = editing ? 'empty row: add dominoes with the buttons above' : 'no dominoes left';
    return;
  }
  const human = !editing && !animating && toMove === you;
  const mine = human ? moves(row, toMove) : [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (W + GAP);
    const d = el('rect', { class: `domino ${row[i]}`, x, y: TOP, width: W, height: H, rx: 3, 'data-i': i }, svg);
    if (editing) d.addEventListener('click', () => recolour(i));
    const idx = el('text', { class: 'idx', x: x + W / 2, y: TOP + H + 22 }, svg);
    idx.textContent = String(i + 1);
    for (const m of mine.filter((mm) => mm.i === i)) drawArrow(m, x);
  }
}

function drawArrow(m: Move, x: number): void {
  const g = el('g', { class: 'arrow', role: 'button', 'aria-label': `topple domino ${m.i + 1} ${m.dir === 'W' ? 'west' : 'east'}` }, svg);
  const bx = m.dir === 'W' ? x - 6 : x + W / 2 + 2;
  if (hintsBox.checked) g.classList.add(moverWins(m.to, toMove) ? 'win' : 'lose');
  el('rect', { x: bx, y: 10, width: 19, height: 30, rx: 5 }, g);
  const t = el('text', { x: bx + 9.5, y: 23 }, g);
  t.textContent = m.dir === 'W' ? '←' : '→';
  if (hintsBox.checked) {
    const mark = el('text', { x: bx + 9.5, y: 36 }, g);
    mark.textContent = moverWins(m.to, toMove) ? '✓' : '✗';
    mark.setAttribute('style', 'font-size: 10px');
  }
  g.addEventListener('click', () => play(m));
}

function play(m: Move): void {
  if (animating) return;
  animating = true;
  window.clearTimeout(cpuTimer);
  render();
  const doms = svg.querySelectorAll<SVGRectElement>('.domino');
  doms.forEach((d) => {
    const i = Number(d.dataset.i ?? d.getAttribute('data-i'));
    if (m.dir === 'W' ? i <= m.i : i >= m.i) {
      d.getBoundingClientRect();
      d.classList.add(`falling-${m.dir}`);
    }
  });
  window.setTimeout(() => {
    history.push({ row, toMove });
    row = m.to;
    toMove = other(toMove);
    animating = false;
    render();
    maybeCpu();
  }, 420);
}

function maybeCpu(): void {
  if (editing || toMove === you || animating) return;
  const ms = moves(row, toMove);
  if (ms.length === 0) return;
  cpuTimer = window.setTimeout(() => {
    const winning = ms.filter((m) => moverWins(m.to, toMove));
    // with a win in hand take one; otherwise keep as many dominoes standing as possible
    const pool = winning.length ? winning : ms.filter((m) => m.to.length === Math.max(...ms.map((mm) => mm.to.length)));
    play(pool[Math.floor(Math.random() * pool.length)]);
  }, 650);
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

function recolour(i: number): void {
  const next = { L: 'R', R: 'E', E: 'L' } as Record<string, string>;
  setRow(row.slice(0, i) + next[row[i]] + row.slice(i + 1));
}

function setRow(r: string): void {
  row = r;
  initial = r;
  history = [];
  rowText.value = r;
  render();
}

function randomRow(): string {
  const n = 9 + Math.floor(Math.random() * 6);
  let s = '';
  for (let i = 0; i < n; i++) s += 'LRE'[Math.random() < 0.15 ? 2 : Math.floor(Math.random() * 2)];
  return s;
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

const short = (g: GameId, max = 160) => {
  const s = name(g);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function describe(g: GameId, r: string): string {
  if (isNumber(g)) {
    const x = numberValue(g);
    if (x === 0) return 'Zero: the player to move loses. The empty row is the only row worth 0 (Lemma 1).';
    return `A number. No other row of any colours is worth ${formatNumber(x)}, and this one is a palindrome (Theorem 16, Corollary 17)${isPalindrome(r) ? '' : ' — yet this row is not one, so something is wrong'}.`;
  }
  for (let m = 1; m <= 24; m++) {
    if (g === nimber(m)) return `The nimber *${m}: like a Nim heap of ${m}. Among rows of blue and red only, *${m} has exactly ${m} forms up to reversal (Theorem 29).`;
  }
  const t = tinyPart(g);
  if (t && t.x === 0) {
    return t.k > 0
      ? `A tiny: positive but smaller than every positive number, and even smaller than ↑. Rows L R (−x) R L give ⧾(x) (Theorem 21).`
      : `A miny, the negative of a tiny. Rows R L x L R give ⧿(x) (Theorem 21).`;
  }
  const [ls, rs] = stops(g);
  if (ls === 0 && rs === 0) return 'An infinitesimal: smaller than every positive number and larger than every negative one.';
  if (ls > rs) return `A hot game: both players want to move. Left stop ${formatNumber(ls)}, right stop ${formatNumber(rs)}.`;
  return `Left stop ${formatNumber(ls)}, right stop ${formatNumber(rs)}.`;
}

function renderValue(): void {
  const g = v.value(row);
  const o = outcome(g);
  const verdict = {
    L: `${who('L')} wins whoever moves first.`,
    R: `${who('R')} wins whoever moves first.`,
    P: 'The player to move loses.',
    N: 'The player to move wins.',
  }[o];
  const nm = short(g, 400);
  const opts = `{ ${leftOptions(g).map((x) => short(x, 40)).join(', ')} | ${rightOptions(g).map((x) => short(x, 40)).join(', ')} }`;
  $('value').innerHTML = `
    <div class="big${nm.length > 28 ? ' long' : ''}">${nm}</div>
    <p class="verdict">${verdict}</p>
    <p class="small dim">${describe(g, row)}</p>
    ${!isNumber(g) && nm !== opts ? `<p class="small dim">canonical form <span class="mono">${opts.length > 220 ? opts.slice(0, 219) + '…' : opts}</span></p>` : ''}
    <p class="small dim">row <span class="mono">${row || '∅'}</span> · ${row.length} domino${row.length === 1 ? '' : 'es'} · at most ${row.length * (row.length + 1) / 2 + 1} positions</p>`;
}

function renderPaper(): void {
  const mark = (s: string) => (s === 'ok' ? '<span class="ok">✓</span>' : s === 'no' ? '<span class="no">✗</span>' : '<span class="info">ℹ</span>');
  // what failed first, then what was confirmed, then the notes
  const order = { no: 0, ok: 1, info: 2 } as Record<string, number>;
  $('paper').innerHTML = `<ul>${[...findings.items]
    .sort((a, b) => order[a.status] - order[b.status])
    .map((f) => `<li>${mark(f.status)}<strong>${f.title}</strong><span class="d">${f.detail}</span></li>`)
    .join('')}</ul><p class="small dim">${findings.footer}</p>`;
}

function renderStatus(): void {
  if (editing) {
    statusEl.innerHTML = `Editing: <code>${row || '∅'}</code>. Press <strong>Play</strong> when the row is ready.`;
    return;
  }
  const ms = moves(row, toMove);
  if (ms.length === 0) {
    statusEl.innerHTML = `${who(toMove)} has no domino to topple and loses. ${toMove === you ? 'The computer wins.' : 'You win.'}`;
    return;
  }
  const wins = ms.filter((m) => moverWins(m.to, toMove)).length;
  const turn = toMove === you ? 'Your move' : 'Computer thinking';
  statusEl.innerHTML = `${turn} — ${who(toMove)} to move. ${hintsBox.checked ? `${wins} of ${ms.length} topples win.` : ''}`;
}

function render(): void {
  document.body.classList.toggle('editing', editing);
  palette.hidden = !editing;
  modeBtn.textContent = editing ? 'Play' : 'Edit';
  drawBoard();
  renderValue();
  renderStatus();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

presetOptions();
renderPaper();
presetSel.addEventListener('change', () => {
  const p = PRESETS.find((pp) => pp.id === presetSel.value)!;
  editing = false;
  load(p.row, p.first);
});
youSel.addEventListener('change', () => {
  you = youSel.value as Player;
  window.clearTimeout(cpuTimer);
  render();
  maybeCpu();
});
firstSel.addEventListener('change', () => load(initial, firstSel.value as Player));
hintsBox.addEventListener('change', render);
$('undo').addEventListener('click', () => {
  window.clearTimeout(cpuTimer);
  // undo back to the human's last turn
  while (history.length) {
    const h = history.pop()!;
    row = h.row;
    toMove = h.toMove;
    if (toMove === you) break;
  }
  animating = false;
  render();
  maybeCpu();
});
$('restart').addEventListener('click', () => load(initial, firstSel.value as Player));
modeBtn.addEventListener('click', () => {
  editing = !editing;
  window.clearTimeout(cpuTimer);
  if (editing) rowText.value = row;
  else load(row, firstSel.value as Player);
  render();
});
palette.querySelectorAll<HTMLButtonElement>('button.add').forEach((b) =>
  b.addEventListener('click', () => { if (row.length < MAX_LEN) setRow(row + b.dataset.add); }));
$('pop').addEventListener('click', () => setRow(row.slice(0, -1)));
$('clear').addEventListener('click', () => setRow(''));
$('random').addEventListener('click', () => setRow(randomRow()));
$('setText').addEventListener('click', () => {
  const r = rowText.value.trim().toUpperCase();
  const ok = ROW_RE.test(r) && r.length <= MAX_LEN;
  rowText.classList.toggle('bad', !ok);
  if (ok) setRow(r);
});

// ?row=LRLRE&first=R deep-links a position
const q = new URLSearchParams(location.search);
const qr = (q.get('row') ?? '').toUpperCase();
if (qr && ROW_RE.test(qr) && qr.length <= MAX_LEN) load(qr, q.get('first') === 'R' ? 'R' : 'L');
else load(PRESETS[0].row, PRESETS[0].first);
