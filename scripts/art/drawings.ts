/**
 * The parts of the 2D pictures that are drawn rather than generated (scripts/art/images.ts):
 * the six console screens, whole, and the lettering and emblems laid over the generated sign
 * plates and poster art. Every word is set from an open font (scripts/art/fonts.ts) so it is spelt
 * exactly as written. Everything shown is fiction: the station, its readings and its signs.
 *
 * The screens share one fictional interface: deep blue-black glass, cyan lines (the game's own
 * accent, #7fd4ff), amber for warnings and red for alarms, Barlow Condensed headings and Share
 * Tech Mono readouts.
 */
import sharp from 'sharp';
import { face } from './fonts.ts';
import type { Font } from './glyphs.ts';

type FontName = 'mono' | 'head' | 'headBold' | 'headHeavy' | 'headMedium' | 'body' | 'bodyBold';

function fontOf(name: FontName): Font {
  switch (name) {
    case 'mono':
      return face('Share Tech Mono', 400);
    case 'head':
      return face('Barlow Condensed', 600);
    case 'headBold':
      return face('Barlow Condensed', 700);
    case 'headHeavy':
      return face('Barlow Condensed', 800);
    case 'headMedium':
      return face('Barlow Condensed', 500);
    case 'body':
      return face('Barlow', 500);
    case 'bodyBold':
      return face('Barlow', 600);
  }
}

interface TextStyle {
  font?: FontName;
  anchor?: 'start' | 'middle' | 'end';
  tracking?: number;
  opacity?: number;
  /** Shrinks the size until the line fits this width. */
  maxWidth?: number;
}

/** One line of text as an SVG path. */
function text(s: string, x: number, y: number, size: number, fill: string, style: TextStyle = {}): string {
  const f = fontOf(style.font ?? 'mono');
  let fitted = size;
  if (style.maxWidth) {
    const width = f.measure(s, size, style.tracking);
    if (width > style.maxWidth) fitted = (size * style.maxWidth) / width;
  }
  const { d } = f.set(s, { x, y, size: fitted, anchor: style.anchor, tracking: style.tracking });
  const opacity = style.opacity === undefined ? '' : ` fill-opacity="${style.opacity}"`;
  return `<path d="${d}" fill="${fill}"${opacity}/>`;
}

/** A small deterministic random number generator, so every build draws the same picture. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

const n = (v: number) => Math.round(v * 100) / 100;

/** An arrow pointing right, its tip at (x, y). */
function arrow(x: number, y: number, length: number, thickness: number, fill: string): string {
  const head = thickness * 1.9;
  const headLength = head * 0.95;
  const t = thickness / 2;
  const pts = [
    [x - length, y - t],
    [x - headLength, y - t],
    [x - headLength, y - head],
    [x, y],
    [x - headLength, y + head],
    [x - headLength, y + t],
    [x - length, y + t],
  ];
  return `<path d="M${pts.map(([px, py]) => `${n(px)} ${n(py)}`).join('L')}Z" fill="${fill}"/>`;
}

// ---------------------------------------------------------------------------------------------
// Console screens
// ---------------------------------------------------------------------------------------------

const UI = {
  glass: '#06111a',
  glass2: '#0a1b28',
  header: '#0c2131',
  line: '#7fd4ff',
  dim: '#3d6f8c',
  faint: '#17384b',
  text: '#d4ecf8',
  mute: '#7593a8',
  amber: '#ffb347',
  red: '#ff5a4a',
  green: '#74e0a6',
  star: '#ff8a3d',
};

interface Chip {
  text: string;
  colour: string;
}

/** The frame every screen shares: glass, grid, header with title and status, footer. */
function screenFrame(w: number, h: number, title: string, chip: Chip, footer: string, body: string): string {
  const grid: string[] = [];
  for (let x = 32; x < w; x += 32) grid.push(`M${x} 48V${h - 36}`);
  for (let y = 64; y < h - 36; y += 32) grid.push(`M0 ${y}H${w}`);
  const chipWidth = fontOf('head').measure(chip.text, 16, 0.12) + 24;
  const corner = (x: number, y: number, dx: number, dy: number) =>
    `<path d="M${x + dx * 18} ${y}H${x}V${y + dy * 18}" stroke="${UI.line}" stroke-width="2" fill="none" opacity="0.7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${UI.glass2}"/><stop offset="1" stop-color="${UI.glass}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#glass)"/>
<path d="${grid.join('')}" stroke="${UI.faint}" stroke-width="1" opacity="0.55"/>
<rect width="${w}" height="46" fill="${UI.header}"/>
<path d="M0 46H${w}" stroke="${UI.line}" stroke-width="1.5" opacity="0.6"/>
<rect x="16" y="14" width="6" height="18" fill="${UI.line}"/>
${text(title, 32, 32, 25, UI.text, { font: 'head', tracking: 0.06 })}
<rect x="${n(w - 20 - chipWidth)}" y="11" width="${n(chipWidth)}" height="24" rx="3" fill="${chip.colour}" fill-opacity="0.16" stroke="${chip.colour}" stroke-width="1.5"/>
${text(chip.text, w - 20 - chipWidth / 2, 29, 16, chip.colour, { font: 'head', tracking: 0.12, anchor: 'middle' })}
${text('CALDER OPS', w - 36 - chipWidth, 29, 14, UI.mute, { anchor: 'end' })}
<path d="M0 ${h - 34}H${w}" stroke="${UI.dim}" stroke-width="1"/>
${text(footer, 20, h - 13, 13, UI.mute)}
${text('ROSS 128 b', w - 20, h - 13, 13, UI.mute, { anchor: 'end' })}
${corner(8, 54, 1, 1)}${corner(w - 8, 54, -1, 1)}${corner(8, h - 42, 1, -1)}${corner(w - 8, h - 42, -1, -1)}
${body}
</svg>`;
}

/** A readout panel on the right: a title and rows of label and value. */
function readout(x: number, y: number, w: number, title: string, rows: [string, string, string?][]): string {
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${rows.length * 44 + 46}" fill="${UI.glass}" fill-opacity="0.7" stroke="${UI.dim}" stroke-width="1"/>`,
    text(title, x + 14, y + 26, 17, UI.line, { font: 'head', tracking: 0.12 }),
    `<path d="M${x + 14} ${y + 36}H${x + w - 14}" stroke="${UI.dim}" stroke-width="1"/>`,
  ];
  rows.forEach(([label, value, colour], i) => {
    const ry = y + 62 + i * 44;
    parts.push(text(label, x + 14, ry, 12, UI.mute, { maxWidth: w - 28 }));
    parts.push(
      text(value, x + 14, ry + 21, 19, colour ?? UI.text, { font: 'headBold', tracking: 0.04, maxWidth: w - 28 }),
    );
  });
  return parts.join('\n');
}

function lightCurve(w: number, h: number): string {
  const [x0, x1, y0, y1] = [96, 730, 78, 408];
  const [fMin, fMax] = [0.925, 1.01];
  const X = (day: number) => x0 + (day / 360) * (x1 - x0);
  const Y = (f: number) => y1 - ((f - fMin) / (fMax - fMin)) * (y1 - y0);
  const steps: [number, number][] = [
    [0, 1.0],
    [52, 0.986],
    [131, 0.973],
    [214, 0.958],
    [291, 0.939],
  ];
  const level = (day: number) => steps.filter(([d]) => d <= day).at(-1)?.[1] ?? 1;
  const rand = random(128);
  const dots: string[] = [];
  for (let day = 0; day <= 360; day += 1.25) {
    const f = level(day) + gauss(rand) * 0.0022;
    dots.push(`M${n(X(day))} ${n(Y(f))}h0.01`);
  }
  let stepPath = `M${X(0)} ${n(Y(1))}`;
  for (const [day, f] of steps.slice(1)) stepPath += `H${n(X(day))}V${n(Y(f))}`;
  stepPath += `H${X(360)}`;
  const ticks: string[] = [];
  for (let f = 0.93; f <= 1.0001; f += 0.01) {
    ticks.push(`<path d="M${x0 - 6} ${n(Y(f))}H${x1}" stroke="${UI.faint}" stroke-width="1"/>`);
    ticks.push(text(f.toFixed(2), x0 - 10, Y(f) + 4, 12, UI.mute, { anchor: 'end' }));
  }
  for (let day = 0; day <= 360; day += 60) {
    ticks.push(`<path d="M${n(X(day))} ${y1}v6" stroke="${UI.dim}" stroke-width="1"/>`);
    ticks.push(text(String(day), X(day), y1 + 20, 12, UI.mute, { anchor: 'middle' }));
  }
  const body = `
${ticks.join('\n')}
<path d="M${x0} ${y0}V${y1}H${x1}" stroke="${UI.dim}" stroke-width="1.5" fill="none"/>
<path d="M${x0} ${n(Y(1))}H${x1}" stroke="${UI.amber}" stroke-width="1.5" stroke-dasharray="7 6" opacity="0.8"/>
${text('CATALOGUE', x1, Y(1) - 8, 13, UI.amber, { anchor: 'end' })}
<path d="${dots.join('')}" stroke="${UI.line}" stroke-width="3.2" stroke-linecap="round" opacity="0.45"/>
<path d="${stepPath}" stroke="${UI.line}" stroke-width="2.5" fill="none"/>
${text('-6.1%', X(360) - 4, Y(0.939) + 30, 26, UI.amber, { font: 'headBold', anchor: 'end' })}
<g transform="rotate(-90 30 ${(y0 + y1) / 2})">${text('RELATIVE FLUX', 30, (y0 + y1) / 2 + 4, 13, UI.mute, { anchor: 'middle', tracking: 0.1 })}</g>
${text('DAYS, STATION CLOCK', (x0 + x1) / 2, y1 + 40, 13, UI.mute, { anchor: 'middle', tracking: 0.1 })}
${readout(762, 70, 242, 'ROSS 128 · VISIBLE', [
  ['CATALOGUE', '1.000'],
  ['MEASURED', '0.939'],
  ['CHANGE', '-6.1 %', UI.amber],
  ['STEPS SEEN', '4'],
  ['STAR MODEL', 'NO MATCH', UI.amber],
  ['FLARE', 'NONE'],
  ['CAMERAS', '2 OF 2 AGREE'],
])}`;
  return screenFrame(
    w,
    h,
    'STELLAR PHOTOMETRY',
    { text: 'REVIEW', colour: UI.amber },
    'COOPERATIVE SURVEY ARRAY · 360-DAY LIGHT CURVE',
    body,
  );
}

function stationMap(w: number, h: number): string {
  const room = (x: number, y: number, rw: number, rh: number, name: string, code: string, colour = UI.line) =>
    `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="4" fill="${colour}" fill-opacity="0.08" stroke="${colour}" stroke-width="2"/>
${text(name, x + 12, y + 28, 21, UI.text, { font: 'headBold', tracking: 0.06, maxWidth: rw - 24 })}
${text(code, x + 12, y + 46, 12, UI.mute)}`;
  const door = (x: number, y: number) =>
    `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${UI.glass}" stroke="${UI.amber}" stroke-width="2" transform="rotate(45 ${x} ${y})"/>`;
  const mx = 640;
  const my = 108;
  const mast = `<path d="M${mx - 14} ${my + 30}L${mx - 3} ${my - 34}M${mx + 14} ${my + 30}L${mx + 3} ${my - 34}M${mx - 12} ${my + 18}L${mx + 10} ${my + 4}L${mx - 8} ${my - 10}L${mx + 6} ${my - 22}" stroke="${UI.line}" stroke-width="2" fill="none"/>
<circle cx="${mx}" cy="${my - 38}" r="4" fill="${UI.red}"/>`;
  const body = `
<path d="M240 292H272M372 224V196M502 312H548M150 348V362" stroke="${UI.line}" stroke-width="8" stroke-linecap="round" opacity="0.5"/>
<path d="M480 236L520 236L520 150L626 150L626 140" stroke="${UI.amber}" stroke-width="3" stroke-dasharray="8 6" fill="none"/>
${room(60, 236, 180, 112, 'QUARTERS', 'Q · NIGHT SHIFT')}
${room(60, 362, 180, 64, 'RANGE', 'Q-2 · PRACTICE')}
${room(290, 116, 170, 80, 'CONTROL', 'C · OPS AND COMMS')}
${room(272, 224, 230, 176, 'CONCOURSE', 'X · MAIN HALL')}
${room(548, 210, 182, 216, 'HANGAR', 'H · BAY 1')}
${mast}
${text('RELAY MAST', mx + 26, my - 18, 18, UI.text, { font: 'headBold', tracking: 0.06 })}
${text('M · OUTSIDE', mx + 26, my, 12, UI.mute)}
${text('CATWALK, OUTSIDE', 528, 170, 12, UI.amber)}
${door(240, 292)}${door(372, 210)}${door(525, 312)}${door(520, 236)}${door(730, 330)}
<circle cx="104" cy="306" r="9" fill="${UI.amber}"/>
<circle cx="104" cy="306" r="16" fill="none" stroke="${UI.amber}" stroke-width="2" opacity="0.6"/>
${text('YOU ARE HERE', 126, 311, 14, UI.amber, { font: 'headBold', tracking: 0.08 })}
<path d="M60 452H160" stroke="${UI.mute}" stroke-width="2"/><path d="M60 446V458M160 446V458" stroke="${UI.mute}" stroke-width="2"/>
${text('50 M', 170, 457, 12, UI.mute)}
<rect x="778" y="70" width="226" height="226" fill="${UI.glass}" fill-opacity="0.7" stroke="${UI.dim}" stroke-width="1"/>
${text('KEY', 792, 96, 17, UI.line, { font: 'head', tracking: 0.12 })}
<path d="M792 106H990" stroke="${UI.dim}" stroke-width="1"/>
<path d="M796 136H836" stroke="${UI.line}" stroke-width="8" stroke-linecap="round" opacity="0.5"/>
${text('ROUTE', 852, 142, 18, UI.text, { font: 'headBold', tracking: 0.04 })}
<path d="M792 180H836" stroke="${UI.amber}" stroke-width="3" stroke-dasharray="8 6"/>
${text('CATWALK, OUTSIDE', 852, 186, 18, UI.amber, { font: 'headBold', tracking: 0.04 })}
${door(814, 224)}
${text('DOOR', 852, 230, 18, UI.text, { font: 'headBold', tracking: 0.04 })}
<circle cx="814" cy="268" r="7" fill="${UI.amber}"/>
${text('YOU ARE HERE', 852, 274, 18, UI.amber, { font: 'headBold', tracking: 0.04 })}
${text('PRESSURE  ALL PARTS NORMAL', 778, 330, 13, UI.green)}
${text('DECK  SURFACE LEVEL', 778, 352, 13, UI.mute)}
${text('MAST  REACHED BY LADDER', 778, 374, 13, UI.mute)}`;
  return screenFrame(
    w,
    h,
    'CALDER STATION · SITE PLAN',
    { text: 'NORMAL', colour: UI.green },
    'SIX PARTS, ONE ROUTE · DOORS SHOWN AT EVERY JOIN',
    body,
  );
}

function sensorSweep(w: number, h: number): string {
  const cx = 300;
  const cy = 268;
  const R = 196;
  const rand = random(4096);
  const rings = [0.25, 0.5, 0.75, 1]
    .map(
      (f) =>
        `<circle cx="${cx}" cy="${cy}" r="${n(R * f)}" fill="none" stroke="${UI.dim}" stroke-width="1" opacity="${f === 1 ? 0.9 : 0.5}"/>`,
    )
    .join('');
  const ticks: string[] = [];
  for (let a = 0; a < 360; a += 10) {
    const rad = ((a - 90) * Math.PI) / 180;
    const inner = a % 30 === 0 ? R - 10 : R - 5;
    ticks.push(
      `M${n(cx + Math.cos(rad) * inner)} ${n(cy + Math.sin(rad) * inner)}L${n(cx + Math.cos(rad) * R)} ${n(cy + Math.sin(rad) * R)}`,
    );
  }
  const labels: string[] = [];
  for (let a = 0; a < 360; a += 30) {
    const rad = ((a - 90) * Math.PI) / 180;
    labels.push(
      text(String(a).padStart(3, '0'), cx + Math.cos(rad) * (R + 18), cy + Math.sin(rad) * (R + 18) + 4, 11, UI.mute, {
        anchor: 'middle',
      }),
    );
  }
  const sweep: string[] = [];
  const lead = -35;
  for (let i = 0; i < 24; i++) {
    const a0 = ((lead - (i + 1) * 2 - 90) * Math.PI) / 180;
    const a1 = ((lead - i * 2 - 90) * Math.PI) / 180;
    sweep.push(
      `<path d="M${cx} ${cy}L${n(cx + Math.cos(a0) * R)} ${n(cy + Math.sin(a0) * R)}A${R} ${R} 0 0 1 ${n(cx + Math.cos(a1) * R)} ${n(cy + Math.sin(a1) * R)}Z" fill="${UI.line}" fill-opacity="${n(0.22 * (1 - i / 24))}"/>`,
    );
  }
  const leadRad = ((lead - 90) * Math.PI) / 180;
  const contacts: string[] = [];
  const bright: string[] = [];
  for (let i = 0; i < 640; i++) {
    const a = rand() * Math.PI * 2;
    const r = 62 + Math.abs(gauss(rand)) * 9 + gauss(rand) * 7;
    const p = `M${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}h0.01`;
    (rand() < 0.12 ? bright : contacts).push(p);
  }
  const planetA = (-62 * Math.PI) / 180;
  const px = cx + Math.cos(planetA) * 150;
  const py = cy + Math.sin(planetA) * 150;
  const body = `
<defs><radialGradient id="star"><stop offset="0" stop-color="#ffd2a1"/><stop offset="0.55" stop-color="${UI.star}"/><stop offset="1" stop-color="${UI.star}" stop-opacity="0"/></radialGradient></defs>
${sweep.join('')}
${rings}
<path d="M${cx - R} ${cy}H${cx + R}M${cx} ${cy - R}V${cy + R}" stroke="${UI.dim}" stroke-width="1" opacity="0.5"/>
<path d="${ticks.join('')}" stroke="${UI.dim}" stroke-width="1.5"/>
${labels.join('')}
<path d="M${cx} ${cy}L${n(cx + Math.cos(leadRad) * R)} ${n(cy + Math.sin(leadRad) * R)}" stroke="${UI.line}" stroke-width="2"/>
<circle cx="${cx}" cy="${cy}" r="26" fill="url(#star)"/>
<path d="${contacts.join('')}" stroke="${UI.amber}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
<path d="${bright.join('')}" stroke="#ffd9a0" stroke-width="3.4" stroke-linecap="round"/>
<circle cx="${cx}" cy="${cy}" r="150" fill="none" stroke="${UI.line}" stroke-width="1" stroke-dasharray="3 5" opacity="0.6"/>
<circle cx="${n(px)}" cy="${n(py)}" r="6" fill="${UI.line}"/>
${text('ROSS 128 b · YOU', px + 12, py - 6, 13, UI.line)}
${text('ROSS 128', cx, cy + 44, 12, UI.mute, { anchor: 'middle' })}
${readout(560, 70, 444, 'CONTACTS ROUND THE STAR', [
  ['COUNT', '3,417 AND RISING', UI.amber],
  ['SIZE, EACH', 'UNDER 2 M'],
  ['EMISSIONS', 'NONE DETECTED'],
  ['IDENTITY CALL', 'NO REPLY', UI.red],
  ['MOTION', 'ORBITING, SPREADING', UI.amber],
  ['LAST SWEEP', '00:00:04 AGO'],
  ['NOTE', 'NOT IN ANY CATALOGUE', UI.amber],
])}`;
  return screenFrame(
    w,
    h,
    'LONG-RANGE SENSORS',
    { text: 'ALERT', colour: UI.amber },
    'PASSIVE SWEEP · OPTICAL AND RADAR · CENTRED ON ROSS 128',
    body,
  );
}

async function commsStatic(w: number, h: number): Promise<string> {
  const [fx, fy, fw, fh] = [40, 150, 680, 258];
  const rand = random(404);
  const data = Buffer.alloc(fw * fh * 3);
  const carriers = [
    { at: 0.18, fade: 0.25 },
    { at: 0.43, fade: 0.55 },
    { at: 0.71, fade: 0.4 },
  ];
  let smooth = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      smooth = smooth * 0.55 + rand() * 0.45;
      let v = 0.04 + smooth * smooth * 0.55 + (rand() < 0.01 ? 0.45 : 0);
      for (const c of carriers) {
        const t = y / fh;
        if (t < c.fade && Math.abs(x / fw - c.at) < 0.004) v += 0.6 * Math.min(1, (c.fade - t) * 5);
      }
      v = Math.min(1, v);
      const i = (y * fw + x) * 3;
      data[i] = Math.round(6 + v * v * 200);
      data[i + 1] = Math.round(16 + v * 210);
      data[i + 2] = Math.round(26 + v * 225);
    }
  }
  const png = await sharp(data, { raw: { width: fw, height: fh, channels: 3 } })
    .png()
    .toBuffer();
  const trace: string[] = [];
  for (let x = 0; x <= fw; x += 3) {
    const v = 0.5 + gauss(rand) * 0.15 + (rand() < 0.04 ? 0.25 : 0);
    trace.push(`${x === 0 ? 'M' : 'L'}${fx + x} ${n(138 - Math.max(0, Math.min(1, v)) * 70)}`);
  }
  const body = `
${text('SPECTRUM', fx, 64 + 4, 12, UI.mute)}
<path d="M${fx} 138H${fx + fw}M${fx} 68H${fx + fw}" stroke="${UI.faint}" stroke-width="1"/>
<path d="${trace.join('')}" stroke="${UI.line}" stroke-width="1.5" fill="none" opacity="0.85"/>
<image x="${fx}" y="${fy}" width="${fw}" height="${fh}" href="data:image/png;base64,${png.toString('base64')}"/>
<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none" stroke="${UI.dim}" stroke-width="1.5"/>
${text('TIME', fx - 8, fy + 14, 11, UI.mute, { anchor: 'end' })}
${text('NOW', fx - 8, fy + fh, 11, UI.mute, { anchor: 'end' })}
<rect x="${fx + fw / 2 - 150}" y="${fy + fh / 2 - 38}" width="300" height="76" fill="${UI.glass}" fill-opacity="0.88" stroke="${UI.red}" stroke-width="2.5"/>
${text('NO CARRIER', fx + fw / 2, fy + fh / 2 + 17, 46, UI.red, { font: 'headBold', anchor: 'middle', tracking: 0.12 })}
${readout(752, 70, 252, 'LINK STATE', [
  ['CHANNEL', 'LANE BEACON 4'],
  ['CARRIER', 'LOST', UI.red],
  ['BEACON REPLY', 'SILENT', UI.red],
  ['HAULER MERROW', 'NO LINK', UI.amber],
  ['NOISE FLOOR', '+31 DB', UI.amber],
  ['NEXT TRY', 'IN 00:12'],
  ['RELAY', 'NO RESPONSE', UI.red],
])}`;
  return screenFrame(
    w,
    h,
    'COMMS · BAND 4',
    { text: 'NO SIGNAL', colour: UI.red },
    'WATERFALL, 2 S PER LINE, NEWEST AT THE BOTTOM · CARRIERS LOST',
    body,
  );
}

function powerDoors(w: number, h: number): string {
  const bus = (y: number, label: string, value: number, state: string, colour: string) =>
    `${text(label, 40, y, 14, UI.mute, { tracking: 0.04 })}
<rect x="40" y="${y + 10}" width="300" height="20" fill="none" stroke="${colour}" stroke-width="1.5"/>
<rect x="43" y="${y + 13}" width="${n(294 * value)}" height="14" fill="${colour}" fill-opacity="0.75"/>
${text(state, 352, y + 26, 17, colour, { font: 'headBold', tracking: 0.06 })}`;
  const doors: [string, string, string, string][] = [
    ['D-01', 'QUARTERS', 'SEALED', UI.amber],
    ['D-02', 'RANGE', 'SEALED', UI.amber],
    ['D-03', 'CONTROL', 'OPEN', UI.line],
    ['D-04', 'CONCOURSE NORTH', 'FAULT', UI.red],
    ['D-05', 'CONCOURSE SOUTH', 'OPEN', UI.line],
    ['D-06', 'MAST AIRLOCK', 'SEALED', UI.amber],
    ['D-07', 'HANGAR', 'BY HAND', UI.amber],
  ];
  const rows = doors
    .map(([id, place, state, colour], i) => {
      const y = 104 + i * 42;
      const chipW = 116;
      return `<path d="M520 ${y + 14}H1000" stroke="${UI.faint}" stroke-width="1"/>
${text(id, 528, y, 15, UI.mute)}
${text(place, 590, y, 18, UI.text, { font: 'head', tracking: 0.05 })}
<rect x="${1000 - chipW}" y="${y - 19}" width="${chipW}" height="26" rx="3" fill="${colour}" fill-opacity="${state === 'FAULT' ? 0.35 : 0.14}" stroke="${colour}" stroke-width="1.5"/>
${text(state, 1000 - chipW / 2, y + 1, 16, colour, { font: 'headBold', anchor: 'middle', tracking: 0.1 })}`;
    })
    .join('\n');
  const body = `
<rect x="0" y="47" width="${w}" height="${h - 81}" fill="${UI.red}" fill-opacity="0.05"/>
${text('POWER', 40, 82, 17, UI.line, { font: 'head', tracking: 0.12 })}
${bus(112, 'MAIN BUS', 0, 'OFFLINE', UI.red)}
${bus(172, 'RESERVE CELLS', 0.38, '38 %', UI.amber)}
${bus(232, 'LIFE SUPPORT', 0.38, 'ON RESERVE', UI.amber)}
${bus(292, 'DOOR MOTORS', 0.15, 'LIMITED', UI.amber)}
${bus(352, 'EMERGENCY LIGHTS', 1, 'ON', UI.red)}
<path d="M490 64V${h - 50}" stroke="${UI.dim}" stroke-width="1"/>
${text('DOORS', 520, 82, 17, UI.line, { font: 'head', tracking: 0.12 })}
${rows}
${text('MANUAL RELEASE: HAND CRANK BEHIND EACH DOOR PANEL', 520, 418, 13, UI.amber)}`;
  return screenFrame(
    w,
    h,
    'POWER AND DOORS',
    { text: 'POWER FAILURE', colour: UI.red },
    'STATION BUS · LAST GOOD READING 00:03:51 AGO',
    body,
  );
}

function navigation(w: number, h: number): string {
  const sx = 190;
  const sy = 290;
  const rand = random(1280);
  const swarm: string[] = [];
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    const r = 70 + gauss(rand) * 7;
    swarm.push(`M${n(sx + Math.cos(a) * r)} ${n(sy + Math.sin(a) * r)}h0.01`);
  }
  const pa = (-38 * Math.PI) / 180;
  const px = sx + Math.cos(pa) * 150;
  const py = sy + Math.sin(pa) * 150;
  const lx = 690;
  const ly = 118;
  const c1 = [px + 120, py - 10];
  const c2 = [lx - 200, ly + 80];
  const curve = `M${n(px)} ${n(py)}C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${lx} ${ly}`;
  const at = (t: number) => {
    const u = 1 - t;
    return [
      u * u * u * px + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * lx,
      u * u * u * py + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * ly,
    ];
  };
  const marks = [0.25, 0.5, 0.75]
    .map((t, i) => {
      const [mx, my] = at(t);
      return `<circle cx="${n(mx)}" cy="${n(my)}" r="3.5" fill="${UI.line}"/>${text(`T+${i + 1}H`, mx + 8, my + 18, 12, UI.mute)}`;
    })
    .join('');
  const [shipX, shipY] = at(0.08);
  const body = `
<defs><radialGradient id="navstar"><stop offset="0" stop-color="#ffd2a1"/><stop offset="0.6" stop-color="${UI.star}"/><stop offset="1" stop-color="${UI.star}" stop-opacity="0"/></radialGradient></defs>
<circle cx="${sx}" cy="${sy}" r="150" fill="none" stroke="${UI.dim}" stroke-width="1.2" stroke-dasharray="4 6"/>
<circle cx="${sx}" cy="${sy}" r="70" fill="none" stroke="${UI.red}" stroke-opacity="0.25" stroke-width="34"/>
<path d="${swarm.join('')}" stroke="${UI.amber}" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
<circle cx="${sx}" cy="${sy}" r="30" fill="url(#navstar)"/>
${text('ROSS 128', sx, sy + 50, 12, UI.mute, { anchor: 'middle' })}
${text('SWARM · KEEP CLEAR', sx, sy - 104, 14, UI.red, { font: 'headBold', anchor: 'middle', tracking: 0.1 })}
<circle cx="${n(px)}" cy="${n(py)}" r="9" fill="#b0704a"/>
${text('ROSS 128 b', px - 14, py + 26, 13, UI.text, { anchor: 'end' })}
<path d="${curve}" stroke="${UI.line}" stroke-width="2.5" fill="none" stroke-dasharray="10 6"/>
${marks}
<path d="M${n(shipX + 9)} ${n(shipY)}L${n(shipX - 7)} ${n(shipY - 7)}L${n(shipX - 3)} ${n(shipY)}L${n(shipX - 7)} ${n(shipY + 7)}Z" fill="${UI.text}" transform="rotate(-24 ${n(shipX)} ${n(shipY)})"/>
<rect x="${lx - 9}" y="${ly - 9}" width="18" height="18" fill="none" stroke="${UI.green}" stroke-width="2.5" transform="rotate(45 ${lx} ${ly})"/>
${text('LANE ENTRY', lx, ly - 22, 16, UI.green, { font: 'headBold', anchor: 'middle', tracking: 0.08 })}
${readout(752, 70, 252, 'DEPARTURE', [
  ['VESSEL', 'LONG-HAUL SURVEYOR'],
  ['STATE', 'CLIMBING'],
  ['TO LANE ENTRY', '3 H 40 M'],
  ['BURN', '0.9 G'],
  ['FUEL', '84 %'],
  ['SWARM CLEARANCE', 'MARGINAL', UI.amber],
  ['LANE BEACON', 'NOT ANSWERING', UI.red],
])}`;
  return screenFrame(
    w,
    h,
    'NAVIGATION · DEPARTURE',
    { text: 'UNDER WAY', colour: UI.green },
    'PLOT CENTRED ON ROSS 128 · NOT TO SCALE',
    body,
  );
}

/** Glass glow, scan lines and a soft vignette over a drawn screen. */
async function screenFinish(svg: string, w: number, h: number): Promise<Buffer> {
  const base = await sharp(Buffer.from(svg)).removeAlpha().png().toBuffer();
  const glow = await sharp(base).blur(5).linear(0.55, 0).png().toBuffer();
  const lines: string[] = [];
  for (let y = 0; y < h; y += 3) lines.push(`M0 ${y + 0.5}H${w}`);
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><radialGradient id="v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient></defs>
<path d="${lines.join('')}" stroke="#000" stroke-opacity="0.16" stroke-width="1"/>
<rect width="${w}" height="${h}" fill="url(#v)"/></svg>`;
  return sharp(base)
    .composite([
      { input: glow, blend: 'screen' },
      { input: Buffer.from(overlay), blend: 'over' },
    ])
    .png()
    .toBuffer();
}

export const SCREENS: Record<string, (w: number, h: number) => string | Promise<string>> = {
  'light-curve': lightCurve,
  'station-map': stationMap,
  'sensor-sweep': sensorSweep,
  'comms-static': commsStatic,
  'power-doors': powerDoors,
  navigation,
};

/** A whole console screen, as a PNG. */
export async function drawScreen(design: string, w: number, h: number): Promise<Buffer> {
  const draw = SCREENS[design];
  if (!draw) throw new Error(`no screen design "${design}"`);
  return screenFinish(await draw(w, h), w, h);
}

// ---------------------------------------------------------------------------------------------
// Signs: lettering and emblems laid over a generated, blank, worn plate
// ---------------------------------------------------------------------------------------------

const PAINT = {
  cream: '#ebe5d4',
  ink: '#1b252d',
  orange: '#f0902c',
  green: '#2f8a4e',
  blue: '#3f7cc0',
  authority: '#3f9160',
};

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

function signCalder(w: number, h: number): string {
  const cx = w / 2;
  const cy = h * 0.4;
  const R = w * 0.29;
  const r = R - 20;
  const hz = cy + r * 0.28;
  const arcs: string[] = [];
  const mx = cx - r * 0.3;
  const top = cy - r * 0.62;
  for (const rr of [16, 28, 40]) {
    for (const side of [1, -1]) {
      const a0 = (-38 * Math.PI) / 180;
      const a1 = (38 * Math.PI) / 180;
      const p0 = [mx + side * Math.cos(a0) * rr, top + Math.sin(a0) * rr];
      const p1 = [mx + side * Math.cos(a1) * rr, top + Math.sin(a1) * rr];
      arcs.push(`M${n(p0[0])} ${n(p0[1])}A${rr} ${rr} 0 0 ${side === 1 ? 1 : 0} ${n(p1[0])} ${n(p1[1])}`);
    }
  }
  const leg = r * 0.16;
  const lattice: string[] = [
    `M${n(mx - leg)} ${n(hz)}L${n(mx - 3)} ${n(top + 6)}`,
    `M${n(mx + leg)} ${n(hz)}L${n(mx + 3)} ${n(top + 6)}`,
  ];
  const rungs = 6;
  for (let i = 0; i < rungs; i++) {
    const t0 = i / rungs;
    const t1 = (i + 1) / rungs;
    const y0 = hz + (top + 6 - hz) * t0;
    const y1 = hz + (top + 6 - hz) * t1;
    const w0 = leg + (3 - leg) * t0;
    const w1 = leg + (3 - leg) * t1;
    lattice.push(
      i % 2 ? `M${n(mx - w0)} ${n(y0)}L${n(mx + w1)} ${n(y1)}` : `M${n(mx + w0)} ${n(y0)}L${n(mx - w1)} ${n(y1)}`,
    );
  }
  return svg(
    w,
    h,
    `<defs><clipPath id="disc"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f6a35a"/><stop offset="1" stop-color="#c8471f"/></radialGradient></defs>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="${PAINT.ink}"/>
<path d="M${cx} ${cy - R + 7}A${R - 7} ${R - 7} 0 0 0 ${cx} ${cy + R - 7}" stroke="${PAINT.authority}" stroke-width="10" fill="none"/>
<path d="M${cx} ${cy - R + 7}A${R - 7} ${R - 7} 0 0 1 ${cx} ${cy + R - 7}" stroke="${PAINT.blue}" stroke-width="10" fill="none"/>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${PAINT.cream}" stroke-width="5"/>
<g clip-path="url(#disc)">
<rect x="${cx - R}" y="${cy - R}" width="${2 * R}" height="${2 * R}" fill="#22313d"/>
<circle cx="${n(cx + r * 0.28)}" cy="${n(hz + 4)}" r="${n(r * 0.42)}" fill="url(#sun)"/>
<rect x="${cx - R}" y="${n(hz)}" width="${2 * R}" height="${R}" fill="#4a3226"/>
<path d="M${cx - R} ${n(hz)}H${cx + R}" stroke="${PAINT.cream}" stroke-width="3"/>
</g>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PAINT.cream}" stroke-width="3"/>
<path d="${lattice.join('')}" stroke="${PAINT.cream}" stroke-width="5" stroke-linecap="round" fill="none"/>
<circle cx="${n(mx)}" cy="${n(top)}" r="6" fill="${PAINT.orange}"/>
<path d="${arcs.join('')}" stroke="${PAINT.cream}" stroke-width="4" stroke-linecap="round" fill="none"/>
${text('CALDER STATION', cx, h * 0.85, 64, PAINT.cream, { font: 'headHeavy', anchor: 'middle', tracking: 0.06, maxWidth: w * 0.84 })}
${text('ROSS 128 b', cx, h * 0.93, 24, PAINT.orange, { font: 'head', anchor: 'middle', tracking: 0.36 })}`,
  );
}

function signConcourseHangar(w: number, h: number): string {
  const size = h * 0.36;
  return svg(
    w,
    h,
    `${text('CONCOURSE', w * 0.07, h * 0.44, size, PAINT.cream, { font: 'headBold', tracking: 0.05 })}
<path d="M${w * 0.07} ${h * 0.53}H${w * 0.7}" stroke="${PAINT.cream}" stroke-width="3" opacity="0.7"/>
${text('HANGAR', w * 0.07, h * 0.86, size, PAINT.cream, { font: 'headBold', tracking: 0.05 })}
<path d="M${w * 0.745} ${h * 0.12}V${h * 0.88}" stroke="${PAINT.cream}" stroke-width="3" opacity="0.7"/>
${arrow(w * 0.905, h * 0.5, w * 0.125, h * 0.16, PAINT.cream)}`,
  );
}

function signClinic(w: number, h: number): string {
  const s = h * 0.7;
  const x = h * 0.17;
  const y = (h - s) / 2;
  const bar = s * 0.22;
  const arm = s * 0.66;
  return svg(
    w,
    h,
    `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="10" fill="${PAINT.green}"/>
<rect x="${x + (s - bar) / 2}" y="${y + (s - arm) / 2}" width="${bar}" height="${arm}" fill="#f4f1e8"/>
<rect x="${x + (s - arm) / 2}" y="${y + (s - bar) / 2}" width="${arm}" height="${bar}" fill="#f4f1e8"/>
${text('CLINIC', x + s + h * 0.16, h * 0.62, h * 0.5, PAINT.ink, { font: 'headHeavy', tracking: 0.05 })}
${text('FIRST AID', x + s + h * 0.17, h * 0.84, h * 0.13, PAINT.green, { font: 'headBold', tracking: 0.32 })}`,
  );
}

function signAirlock(w: number, h: number): string {
  const b = h * 0.11;
  const stripes: string[] = [];
  for (let x = -h; x < w + h; x += b * 2)
    stripes.push(`M${n(x)} 0L${n(x + b)} 0L${n(x + b + h)} ${h}L${n(x + h)} ${h}Z`);
  const tx = h * 0.2 + b;
  const ts = h * 0.56;
  const tri = `M${n(tx + ts / 2)} ${n(h / 2 - ts * 0.45)}L${n(tx + ts)} ${n(h / 2 + ts * 0.42)}L${n(tx)} ${n(h / 2 + ts * 0.42)}Z`;
  return svg(
    w,
    h,
    `<defs><clipPath id="edge"><path d="M0 0H${w}V${h}H0Z M${b} ${b}V${h - b}H${w - b}V${b}Z" clip-rule="evenodd"/></clipPath></defs>
<rect width="${w}" height="${h}" fill="#16191c"/>
<g clip-path="url(#edge)"><path d="${stripes.join('')}" fill="${PAINT.orange}"/></g>
<rect x="${b}" y="${b}" width="${w - 2 * b}" height="${h - 2 * b}" fill="#23292e"/>
<path d="${tri}" fill="${PAINT.orange}" stroke="${PAINT.orange}" stroke-width="10" stroke-linejoin="round"/>
<rect x="${n(tx + ts / 2 - ts * 0.055)}" y="${n(h / 2 - ts * 0.17)}" width="${n(ts * 0.11)}" height="${n(ts * 0.36)}" rx="3" fill="#16191c"/>
<circle cx="${n(tx + ts / 2)}" cy="${n(h / 2 + ts * 0.29)}" r="${n(ts * 0.065)}" fill="#16191c"/>
${text('AIRLOCK', tx + ts + h * 0.14, h * 0.6, h * 0.42, PAINT.orange, { font: 'headHeavy', tracking: 0.08 })}
${text('CHECK YOUR SUIT SEAL BEFORE YOU CYCLE', tx + ts + h * 0.15, h * 0.79, h * 0.1, PAINT.cream, { font: 'headBold', tracking: 0.12, maxWidth: w - (tx + ts + h * 0.15) - b - 30 })}`,
  );
}

export const SIGNS: Record<string, (w: number, h: number) => string> = {
  calder: signCalder,
  'concourse-hangar': signConcourseHangar,
  clinic: signClinic,
  airlock: signAirlock,
};

// ---------------------------------------------------------------------------------------------
// Posters: generated art in a printed layout, with the words set by us
// ---------------------------------------------------------------------------------------------

export interface PosterLayout {
  /** Where the art sits, in pixels. */
  art: { x: number; y: number; w: number; h: number };
  /** Drawn under the art. */
  under: string;
  /** Drawn over the art. */
  over: string;
}

function posterCooperative(w: number, h: number): PosterLayout {
  const top = h * 0.24;
  const foot = h * 0.8;
  const blue = '#173a63';
  const cream = '#efe6d2';
  return {
    art: { x: 0, y: top, w, h: foot - top },
    under: svg(
      w,
      h,
      `<rect width="${w}" height="${h}" fill="${cream}"/><rect width="${w}" height="${top}" fill="${blue}"/>`,
    ),
    over: svg(
      w,
      h,
      `<path d="M0 ${top}H${w}M0 ${foot}H${w}" stroke="${PAINT.orange}" stroke-width="4"/>
${text('FRONTIER COOPERATIVE · SURVEY SERVICE', w / 2, h * 0.055, h * 0.022, '#9fc2e8', { font: 'headBold', anchor: 'middle', tracking: 0.22 })}
${text('THE STARS', w / 2, h * 0.135, h * 0.075, cream, { font: 'headHeavy', anchor: 'middle', tracking: 0.04 })}
${text('NEED COUNTING', w / 2, h * 0.215, h * 0.075, cream, { font: 'headHeavy', anchor: 'middle', tracking: 0.04, maxWidth: w * 0.9 })}
${text('SURVEY CREWS WANTED', w / 2, h * 0.86, h * 0.042, blue, { font: 'headHeavy', anchor: 'middle', tracking: 0.08 })}
${text('Ranks voted in. Shares paid out. Skies no one has charted.', w / 2, h * 0.905, h * 0.021, blue, { font: 'bodyBold', anchor: 'middle', maxWidth: w * 0.88 })}
${text('Ask at any Cooperative office.', w / 2, h * 0.945, h * 0.019, '#4a5f78', { font: 'body', anchor: 'middle' })}`,
    ),
  };
}

function posterAuthority(w: number, h: number): PosterLayout {
  const top = h * 0.2;
  const foot = h * 0.78;
  const green = '#24563a';
  const cream = '#efe8d4';
  const yellow = '#f2c230';
  return {
    art: { x: 0, y: top, w, h: foot - top },
    under: svg(
      w,
      h,
      `<rect width="${w}" height="${h}" fill="${cream}"/><rect width="${w}" height="${top}" fill="${green}"/>`,
    ),
    over: svg(
      w,
      h,
      `<path d="M0 ${top}H${w}M0 ${foot}H${w}" stroke="${yellow}" stroke-width="5"/>
${text('SOL TRANSIT AUTHORITY · SAFETY NOTICE 14', w / 2, h * 0.05, h * 0.021, '#a9d6b8', { font: 'headBold', anchor: 'middle', tracking: 0.2, maxWidth: w * 0.9 })}
${text('MIND THE LANES', w / 2, h * 0.16, h * 0.098, cream, { font: 'headHeavy', anchor: 'middle', tracking: 0.03, maxWidth: w * 0.92 })}
${text('Walk between the yellow lines.', w / 2, h * 0.835, h * 0.034, green, { font: 'bodyBold', anchor: 'middle', maxWidth: w * 0.9 })}
${text('Loaders cannot stop quickly.', w / 2, h * 0.88, h * 0.034, green, { font: 'bodyBold', anchor: 'middle', maxWidth: w * 0.9 })}
<path d="M${w * 0.3} ${h * 0.905}H${w * 0.7}" stroke="${green}" stroke-width="1.5" opacity="0.5"/>
${text('The lanes are safer than they were. Not safe. Safer.', w / 2, h * 0.94, h * 0.02, '#4c5d52', { font: 'body', anchor: 'middle', maxWidth: w * 0.9 })}`,
    ),
  };
}

export const POSTERS: Record<string, (w: number, h: number) => PosterLayout> = {
  cooperative: posterCooperative,
  authority: posterAuthority,
};
