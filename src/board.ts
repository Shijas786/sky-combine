import './styles.css';
import { DRILL_IDS, DRILL_LABELS } from './core/scoring';
import { Leaderboard, type Entry, type LiveMessage } from './core/store';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const board = new Leaderboard(localStorage);
const ROWS = 10;
let known = new Set(board.all().map((e) => e.id));

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

function render(): void {
  const entries = board.all();
  const fresh = entries.filter((e) => !known.has(e.id)).map((e) => e.id);
  known = new Set(entries.map((e) => e.id));

  $('statPlayers').textContent = String(entries.length);
  $('statBest').textContent = entries.length ? String(entries[0].rating) : '--';
  $('statAvg').textContent = entries.length ? String(Math.round(entries.reduce((a, e) => a + e.rating, 0) / entries.length)) : '--';

  const row = (e: Entry, i: number) => `
    <li class="${i < 3 ? 'top' : ''} ${fresh.includes(e.id) ? 'fresh' : ''}" style="--i:${i}">
      <span class="pos">${i + 1}</span>
      <span class="who">${esc(e.name)}</span>
      <span class="arch">${esc(e.archetype)}</span>
      <span class="mini">${DRILL_IDS.map((id) => `<i style="height:${Math.max(4, e.stats[id])}%"></i>`).join('')}</span>
      <span class="rate">${e.rating}</span>
    </li>`;
  $('rows').innerHTML = entries.length
    ? entries.slice(0, ROWS).map(row).join('')
    : '<li><span class="empty">NO RUNS YET · BE THE FIRST ON THE BOARD</span></li>';

  $('leaders').innerHTML = DRILL_IDS.map((id) => {
    const best = [...entries].sort((a, b) => b.stats[id] - a.stats[id])[0];
    return `<li><span>${DRILL_LABELS[id].toUpperCase()}</span><span><b>${best ? esc(best.name) : '--'}</b><em>${best ? best.stats[id] : ''}</em></span></li>`;
  }).join('');

  const latest = [...entries].sort((a, b) => b.ts - a.ts)[0];
  $('latest').innerHTML = latest
    ? `<b>${esc(latest.name)} · ${latest.rating}</b>${esc(latest.archetype)} · ranked #${entries.findIndex((e) => e.id === latest.id) + 1} of ${entries.length}`
    : 'No runs yet';
}

function live(m: LiveMessage): void {
  if (m.type === 'entries') return render();
  const now = $('now');
  now.classList.toggle('live', m.type === 'live');
  $('nowText').textContent = m.type === 'live' ? `NOW PLAYING · ${m.name} · ${m.drill} (${m.step}/${m.total})` : 'WAITING FOR THE NEXT CHALLENGER';
}

board.listen(live);
$('csvBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([board.csv()], { type: 'text/csv' }));
  a.download = 'sky-combine-leaderboard.csv';
  a.click();
});
let armed = 0;
$('clearBtn').addEventListener('click', () => {
  if (Date.now() - armed < 3000) {
    board.clear();
    $('clearBtn').textContent = 'RESET BOARD';
    render();
  } else {
    armed = Date.now();
    $('clearBtn').textContent = 'CLICK AGAIN TO CONFIRM';
    window.setTimeout(() => ($('clearBtn').textContent = 'RESET BOARD'), 3000);
  }
});
render();
