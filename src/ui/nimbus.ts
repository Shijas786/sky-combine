/** Nimbus, the combine's scout drone: an original mascot drawn in SVG. */
export const NIMBUS_SVG = `
<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="nb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9fdcff"/></linearGradient>
    <linearGradient id="nv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06224a"/><stop offset="1" stop-color="#030611"/></linearGradient>
  </defs>
  <g class="nimbus-rotor"><ellipse cx="100" cy="18" rx="46" ry="5" fill="#7df9ff" opacity="0.55"/></g>
  <rect x="97" y="18" width="6" height="22" rx="3" fill="#9fdcff"/>
  <path d="M48 118c-22 0-34-14-34-30 0-17 13-29 29-30 4-20 21-32 42-32 19 0 34 9 41 24 3-1 6-1 9-1 20 0 35 14 35 34s-15 35-36 35z" fill="url(#nb)" stroke="#00aeef" stroke-width="4"/>
  <rect x="52" y="64" width="96" height="36" rx="18" fill="url(#nv)" stroke="#00aeef" stroke-width="3"/>
  <g class="nimbus-eyes" fill="#7df9ff"><rect x="72" y="74" width="14" height="16" rx="6"/><rect x="114" y="74" width="14" height="16" rx="6"/></g>
  <path d="M70 132l-8 20M130 132l8 20M100 134v24" stroke="#00aeef" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
  <circle cx="100" cy="160" r="6" fill="#ff3d6e" class="nimbus-light"/>
</svg>`;

const LINES = {
  attract: ['I scout for the big leagues. Show me what you have.', 'Two minutes. Five drills. One scouting report.', 'Think you are pro material? Prove it.'],
  low: ['Shake it off. Next drill.', 'Even pros have off rounds.', 'Warm-up is over. Lock in.'],
  mid: ['Solid. I am taking notes.', 'Clean work. Keep it up.', 'That gets you on my shortlist.'],
  high: ['Now THAT is pro material.', 'Unreal. Who trained you?', 'I am calling the coach right now.'],
};

export function nimbusLine(kind: keyof typeof LINES, roll: number): string {
  const set = LINES[kind];
  return set[Math.floor(roll * set.length) % set.length];
}

export const nimbusLineForScore = (score: number, roll: number) => nimbusLine(score >= 75 ? 'high' : score >= 45 ? 'mid' : 'low', roll);
