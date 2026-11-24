import qrcode from 'qrcode-generator';
import { DRILL_IDS, DRILL_LABELS, archetypeFor, tierFor, type Stats } from '../core/scoring';
import { encodeCard } from '../core/store';

export const CARD_W = 1080;
export const CARD_H = 1350;
const DISPLAY = 'Orbitron, sans-serif';
const BODY = 'Rajdhani, sans-serif';

export function shareUrl(name: string, rating: number, stats: Stats): string {
  const base = (import.meta.env.VITE_SHARE_URL as string | undefined) || `${location.origin}${location.pathname}`;
  return `${base}#c=${encodeCard(name, rating, stats)}`;
}

function radar(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, stats: Stats, color: string, t: number): void {
  const n = DRILL_IDS.length;
  const at = (i: number, k: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k] as const;
  };
  g.lineWidth = 2;
  for (let ring = 1; ring <= 4; ring++) {
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(i % n, ring / 4);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.strokeStyle = `rgba(160,220,255,${ring === 4 ? 0.45 : 0.16})`;
    g.stroke();
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = at(i, 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(x, y);
    g.strokeStyle = 'rgba(160,220,255,0.16)';
    g.stroke();
    const [lx, ly] = at(i, 1.2);
    g.font = `700 30px ${BODY}`;
    g.fillStyle = '#cfe9ff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(DRILL_LABELS[DRILL_IDS[i]].toUpperCase(), lx, ly);
  }
  g.beginPath();
  DRILL_IDS.forEach((id, i) => {
    const [x, y] = at(i, Math.max(0.06, (stats[id] / 100) * t));
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  });
  g.closePath();
  g.fillStyle = `${color}55`;
  g.shadowColor = color;
  g.shadowBlur = 40;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 5;
  g.strokeStyle = color;
  g.stroke();
  DRILL_IDS.forEach((id, i) => {
    const [x, y] = at(i, Math.max(0.06, (stats[id] / 100) * t));
    g.beginPath();
    g.arc(x, y, 8, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
  });
}

/** Draws the scouting report. `t` (0..1) animates the radar and bars for the reveal. */
export function drawCard(canvas: HTMLCanvasElement, name: string, rating: number, stats: Stats, t = 1): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext('2d')!;
  const tier = tierFor(rating);
  const arch = archetypeFor(stats);

  const bg = g.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, '#071a3a');
  bg.addColorStop(0.55, '#040b1c');
  bg.addColorStop(1, '#03060f');
  g.fillStyle = bg;
  g.fillRect(0, 0, CARD_W, CARD_H);
  const glow = g.createRadialGradient(CARD_W * 0.8, 120, 0, CARD_W * 0.8, 120, 760);
  glow.addColorStop(0, `${tier.color}55`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.strokeStyle = 'rgba(0,174,239,0.08)';
  g.lineWidth = 1;
  for (let x = -CARD_H; x < CARD_W; x += 38) {
    g.beginPath();
    g.moveTo(x, CARD_H);
    g.lineTo(x + CARD_H, 0);
    g.stroke();
  }
  g.strokeStyle = tier.color;
  g.lineWidth = 6;
  g.strokeRect(27, 27, CARD_W - 54, CARD_H - 54);
  g.fillStyle = tier.color;
  g.fillRect(27, 27, 220, 12);
  g.fillRect(CARD_W - 247, CARD_H - 39, 220, 12);

  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = '#7df9ff';
  g.font = `800 34px ${DISPLAY}`;
  g.fillText('SKY COMBINE', 76, 112);
  g.fillStyle = 'rgba(207,233,255,0.7)';
  g.font = `600 28px ${BODY}`;
  g.fillText('OFFICIAL SCOUTING REPORT', 76, 150);

  g.fillStyle = '#fff';
  let size = 118;
  do {
    g.font = `900 ${size}px ${DISPLAY}`;
    size -= 6;
  } while (g.measureText(name).width > 610 && size > 40);
  g.fillText(name, 72, 300);

  g.fillStyle = tier.color;
  g.font = `800 40px ${DISPLAY}`;
  g.fillText(tier.name, 76, 366);
  g.fillStyle = '#fff';
  g.font = `700 46px ${BODY}`;
  g.fillText(`ROLE · ${arch.name}`, 76, 430);
  g.fillStyle = 'rgba(207,233,255,0.8)';
  g.font = `500 31px ${BODY}`;
  const words = arch.blurb.split(' ');
  let line = '';
  let y = 476;
  for (const w of words) {
    if (g.measureText(`${line}${w} `).width > 560) {
      g.fillText(line, 76, y);
      line = '';
      y += 38;
    }
    line += `${w} `;
  }
  g.fillText(line, 76, y);

  g.textAlign = 'right';
  g.shadowColor = tier.color;
  g.shadowBlur = 50;
  g.fillStyle = tier.color;
  g.font = `900 250px ${DISPLAY}`;
  g.fillText(String(Math.round(40 + (rating - 40) * t)), CARD_W - 70, 330);
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(207,233,255,0.7)';
  g.font = `700 30px ${BODY}`;
  g.fillText('OVERALL RATING', CARD_W - 76, 380);

  radar(g, 330, 830, 215, stats, tier.color, t);

  DRILL_IDS.forEach((id, i) => {
    const x = 640;
    const yy = 640 + i * 78;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#cfe9ff';
    g.font = `700 30px ${BODY}`;
    g.fillText(DRILL_LABELS[id].toUpperCase(), x, yy);
    g.textAlign = 'right';
    g.fillStyle = '#fff';
    g.font = `800 32px ${DISPLAY}`;
    g.fillText(String(Math.round(stats[id] * t)), x + 370, yy);
    g.fillStyle = 'rgba(160,220,255,0.15)';
    g.fillRect(x, yy + 12, 370, 10);
    g.fillStyle = tier.color;
    g.fillRect(x, yy + 12, 370 * (stats[id] / 100) * t, 10);
  });

  const qr = qrcode(0, 'M');
  qr.addData(shareUrl(name, rating, stats));
  qr.make();
  const count = qr.getModuleCount();
  const box = 190;
  const cell = box / count;
  const qx = CARD_W - 76 - box;
  const qy = CARD_H - 96 - box;
  g.fillStyle = '#fff';
  g.fillRect(qx - 12, qy - 12, box + 24, box + 24);
  g.fillStyle = '#03060f';
  for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) g.fillRect(qx + c * cell, qy + r * cell, cell + 0.5, cell + 0.5);

  g.textAlign = 'left';
  g.fillStyle = '#fff';
  g.font = `700 36px ${BODY}`;
  g.fillText('SCAN TO KEEP YOUR CARD', 76, CARD_H - 190);
  g.fillStyle = 'rgba(207,233,255,0.7)';
  g.font = `500 28px ${BODY}`;
  g.fillText('5 drills · 2 minutes · are you pro material?', 76, CARD_H - 150);
  g.fillStyle = 'rgba(207,233,255,0.5)';
  g.font = `600 24px ${BODY}`;
  g.fillText(`SKY'S THE LIMIT 2026 · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`, 76, CARD_H - 96);
}

export function downloadCard(canvas: HTMLCanvasElement, name: string): void {
  const a = document.createElement('a');
  a.download = `sky-combine-${name.toLowerCase()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
