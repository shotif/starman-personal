/**
 * Sets lines of text as SVG outlines, read straight from a TrueType font file, for the lettering
 * on signs, posters and console screens (scripts/art/images.ts). Drawing the outlines ourselves
 * means the words are spelt exactly as written and look the same on every machine: sharp's own
 * text rendering on macOS ignores font files and falls back to the system fonts.
 *
 * Reads the tables a static TrueType font needs for this: cmap (formats 4 and 12), hmtx, loca and
 * glyf (simple and composite glyphs), and pair kerning from GPOS (lookup types 2 and 9).
 */
import { readFileSync } from 'node:fs';

interface Point {
  x: number;
  y: number;
  on: boolean;
}

export interface SetText {
  /** SVG path data, already placed and scaled. */
  d: string;
  /** The line's advance width in pixels. */
  width: number;
}

export interface TextOptions {
  x: number;
  /** The baseline. */
  y: number;
  size: number;
  anchor?: 'start' | 'middle' | 'end';
  /** Extra space between letters, as a fraction of the size. */
  tracking?: number;
}

export class Font {
  readonly unitsPerEm: number;
  readonly ascender: number;
  readonly descender: number;
  private readonly buf: Buffer;
  private readonly tables = new Map<string, number>();
  private readonly longLoca: boolean;
  private readonly numberOfHMetrics: number;
  private readonly cmap: (codePoint: number) => number;
  private readonly kernLookups: number[] = [];
  private readonly kernCache = new Map<number, number>();
  private readonly glyphCache = new Map<number, Point[][]>();

  constructor(file: string) {
    this.buf = readFileSync(file);
    const count = this.buf.readUInt16BE(4);
    for (let i = 0; i < count; i++) {
      const at = 12 + 16 * i;
      this.tables.set(this.buf.toString('latin1', at, at + 4), this.buf.readUInt32BE(at + 8));
    }
    const head = this.table('head');
    this.unitsPerEm = this.buf.readUInt16BE(head + 18);
    this.longLoca = this.buf.readInt16BE(head + 50) === 1;
    const hhea = this.table('hhea');
    this.ascender = this.buf.readInt16BE(hhea + 4);
    this.descender = this.buf.readInt16BE(hhea + 6);
    this.numberOfHMetrics = this.buf.readUInt16BE(hhea + 34);
    this.cmap = this.readCmap();
    this.readKernLookups();
  }

  private table(tag: string): number {
    const at = this.tables.get(tag);
    if (at === undefined) throw new Error(`the font has no ${tag} table`);
    return at;
  }

  private readCmap(): (codePoint: number) => number {
    const cmap = this.table('cmap');
    const count = this.buf.readUInt16BE(cmap + 2);
    let format4 = -1;
    let format12 = -1;
    for (let i = 0; i < count; i++) {
      const rec = cmap + 4 + 8 * i;
      const platform = this.buf.readUInt16BE(rec);
      const encoding = this.buf.readUInt16BE(rec + 2);
      const sub = cmap + this.buf.readUInt32BE(rec + 4);
      const format = this.buf.readUInt16BE(sub);
      if (format === 12 && (platform === 0 || (platform === 3 && encoding === 10))) format12 = sub;
      if (format === 4 && (platform === 0 || (platform === 3 && encoding === 1))) format4 = sub;
    }
    const b = this.buf;
    if (format12 >= 0) {
      const groups = b.readUInt32BE(format12 + 12);
      return (c) => {
        for (let g = 0; g < groups; g++) {
          const at = format12 + 16 + 12 * g;
          const start = b.readUInt32BE(at);
          if (c >= start && c <= b.readUInt32BE(at + 4)) return b.readUInt32BE(at + 8) + c - start;
        }
        return 0;
      };
    }
    if (format4 < 0) throw new Error('the font has no Unicode cmap');
    const segX2 = b.readUInt16BE(format4 + 6);
    const ends = format4 + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    return (c) => {
      for (let s = 0; s < segX2; s += 2) {
        if (c > b.readUInt16BE(ends + s)) continue;
        const start = b.readUInt16BE(starts + s);
        if (c < start) return 0;
        const delta = b.readUInt16BE(deltas + s);
        const range = b.readUInt16BE(ranges + s);
        if (range === 0) return (c + delta) & 0xffff;
        const g = b.readUInt16BE(ranges + s + range + 2 * (c - start));
        return g === 0 ? 0 : (g + delta) & 0xffff;
      }
      return 0;
    };
  }

  /** Finds the GPOS lookups behind the `kern` feature. */
  private readKernLookups(): void {
    const gpos = this.tables.get('GPOS');
    if (gpos === undefined) return;
    const b = this.buf;
    const features = gpos + b.readUInt16BE(gpos + 6);
    const lookupList = gpos + b.readUInt16BE(gpos + 8);
    const wanted = new Set<number>();
    for (let i = 0; i < b.readUInt16BE(features); i++) {
      const rec = features + 2 + 6 * i;
      if (b.toString('latin1', rec, rec + 4) !== 'kern') continue;
      const feature = features + b.readUInt16BE(rec + 4);
      for (let j = 0; j < b.readUInt16BE(feature + 2); j++) wanted.add(b.readUInt16BE(feature + 4 + 2 * j));
    }
    for (const index of [...wanted].sort((p, q) => p - q)) {
      const lookup = lookupList + b.readUInt16BE(lookupList + 2 + 2 * index);
      const type = b.readUInt16BE(lookup);
      for (let s = 0; s < b.readUInt16BE(lookup + 4); s++) {
        let sub = lookup + b.readUInt16BE(lookup + 6 + 2 * s);
        let subType = type;
        if (type === 9) {
          subType = b.readUInt16BE(sub + 2);
          sub += b.readUInt32BE(sub + 4);
        }
        if (subType === 2) this.kernLookups.push(sub);
      }
    }
  }

  private coverage(at: number, glyph: number): number {
    const b = this.buf;
    const format = b.readUInt16BE(at);
    const count = b.readUInt16BE(at + 2);
    for (let i = 0; i < count; i++) {
      if (format === 1) {
        if (b.readUInt16BE(at + 4 + 2 * i) === glyph) return i;
      } else {
        const rec = at + 4 + 6 * i;
        const start = b.readUInt16BE(rec);
        if (glyph >= start && glyph <= b.readUInt16BE(rec + 2)) return b.readUInt16BE(rec + 4) + glyph - start;
      }
    }
    return -1;
  }

  private classOf(at: number, glyph: number): number {
    const b = this.buf;
    if (b.readUInt16BE(at) === 1) {
      const start = b.readUInt16BE(at + 2);
      const count = b.readUInt16BE(at + 4);
      return glyph >= start && glyph < start + count ? b.readUInt16BE(at + 6 + 2 * (glyph - start)) : 0;
    }
    for (let i = 0; i < b.readUInt16BE(at + 2); i++) {
      const rec = at + 4 + 6 * i;
      if (glyph >= b.readUInt16BE(rec) && glyph <= b.readUInt16BE(rec + 2)) return b.readUInt16BE(rec + 4);
    }
    return 0;
  }

  /** The kerning between two glyphs, in font units (usually negative). */
  kern(left: number, right: number): number {
    const key = left * 65536 + right;
    const cached = this.kernCache.get(key);
    if (cached !== undefined) return cached;
    const b = this.buf;
    const valueSize = (format: number) => 2 * [...format.toString(2)].filter((d) => d === '1').length;
    const xAdvance = (at: number, format: number) => {
      if (!(format & 4)) return 0;
      const before = [1, 2].filter((bit) => format & bit).length;
      return b.readInt16BE(at + 2 * before);
    };
    let result: number | undefined;
    for (const sub of this.kernLookups) {
      const cov = this.coverage(sub + b.readUInt16BE(sub + 2), left);
      if (cov < 0) continue;
      const vf1 = b.readUInt16BE(sub + 4);
      const vf2 = b.readUInt16BE(sub + 6);
      const pairSize = valueSize(vf1) + valueSize(vf2);
      if (b.readUInt16BE(sub) === 1) {
        const set = sub + b.readUInt16BE(sub + 10 + 2 * cov);
        for (let i = 0; i < b.readUInt16BE(set); i++) {
          const rec = set + 2 + i * (2 + pairSize);
          if (b.readUInt16BE(rec) === right) {
            result = xAdvance(rec + 2, vf1);
            break;
          }
        }
      } else {
        const c1 = this.classOf(sub + b.readUInt16BE(sub + 8), left);
        const c2 = this.classOf(sub + b.readUInt16BE(sub + 10), right);
        const class2Count = b.readUInt16BE(sub + 14);
        result = xAdvance(sub + 16 + (c1 * class2Count + c2) * pairSize, vf1);
      }
      if (result !== undefined) break;
    }
    this.kernCache.set(key, result ?? 0);
    return result ?? 0;
  }

  glyphIndex(codePoint: number): number {
    return this.cmap(codePoint);
  }

  advance(glyph: number): number {
    const hmtx = this.table('hmtx');
    return this.buf.readUInt16BE(hmtx + 4 * Math.min(glyph, this.numberOfHMetrics - 1));
  }

  private loca(glyph: number): number {
    const loca = this.table('loca');
    return this.longLoca ? this.buf.readUInt32BE(loca + 4 * glyph) : this.buf.readUInt16BE(loca + 2 * glyph) * 2;
  }

  /** The glyph's contours in font units, y up. */
  contours(glyph: number): Point[][] {
    const cached = this.glyphCache.get(glyph);
    if (cached) return cached;
    const b = this.buf;
    const start = this.loca(glyph);
    const out: Point[][] = [];
    if (this.loca(glyph + 1) > start) {
      const at = this.table('glyf') + start;
      const n = b.readInt16BE(at);
      if (n >= 0) out.push(...this.simple(at, n));
      else out.push(...this.composite(at));
    }
    this.glyphCache.set(glyph, out);
    return out;
  }

  private simple(at: number, contourCount: number): Point[][] {
    const b = this.buf;
    const ends: number[] = [];
    for (let i = 0; i < contourCount; i++) ends.push(b.readUInt16BE(at + 10 + 2 * i));
    const count = contourCount ? ends[contourCount - 1] + 1 : 0;
    let p = at + 10 + 2 * contourCount;
    p += 2 + b.readUInt16BE(p);
    const flags: number[] = [];
    while (flags.length < count) {
      const f = b.readUInt8(p++);
      flags.push(f);
      if (f & 8) for (let r = b.readUInt8(p++); r > 0; r--) flags.push(f);
    }
    const read = (short: number, same: number) => {
      const values: number[] = [];
      let v = 0;
      for (const f of flags) {
        if (f & short) {
          const d = b.readUInt8(p++);
          v += f & same ? d : -d;
        } else if (!(f & same)) {
          v += b.readInt16BE(p);
          p += 2;
        }
        values.push(v);
      }
      return values;
    };
    const xs = read(2, 16);
    const ys = read(4, 32);
    const out: Point[][] = [];
    let first = 0;
    for (const end of ends) {
      const contour: Point[] = [];
      for (let i = first; i <= end; i++) contour.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) === 1 });
      out.push(contour);
      first = end + 1;
    }
    return out;
  }

  private composite(at: number): Point[][] {
    const b = this.buf;
    const out: Point[][] = [];
    let p = at + 10;
    let flags: number;
    do {
      flags = b.readUInt16BE(p);
      const component = b.readUInt16BE(p + 2);
      p += 4;
      let dx = 0;
      let dy = 0;
      if (flags & 1) {
        dx = b.readInt16BE(p);
        dy = b.readInt16BE(p + 2);
        p += 4;
      } else {
        dx = b.readInt8(p);
        dy = b.readInt8(p + 1);
        p += 2;
      }
      if (!(flags & 2)) {
        dx = 0;
        dy = 0;
      }
      let [xx, xy, yx, yy] = [1, 0, 0, 1];
      const f2dot14 = (q: number) => b.readInt16BE(q) / 16384;
      if (flags & 8) {
        xx = yy = f2dot14(p);
        p += 2;
      } else if (flags & 0x40) {
        xx = f2dot14(p);
        yy = f2dot14(p + 2);
        p += 4;
      } else if (flags & 0x80) {
        [xx, xy, yx, yy] = [f2dot14(p), f2dot14(p + 2), f2dot14(p + 4), f2dot14(p + 6)];
        p += 8;
      }
      for (const contour of this.contours(component)) {
        out.push(contour.map((q) => ({ x: xx * q.x + yx * q.y + dx, y: xy * q.x + yy * q.y + dy, on: q.on })));
      }
    } while (flags & 0x20);
    return out;
  }

  /** Lays out one line of text; throws if the font lacks a character, so no letter goes missing. */
  set(text: string, options: TextOptions): SetText {
    const scale = options.size / this.unitsPerEm;
    const tracking = (options.tracking ?? 0) * this.unitsPerEm;
    const glyphs = [...text].map((ch) => {
      const g = this.glyphIndex(ch.codePointAt(0) ?? 0);
      if (g === 0 && ch !== ' ') throw new Error(`the font has no glyph for "${ch}"`);
      return g;
    });
    const xs: number[] = [];
    let pen = 0;
    glyphs.forEach((g, i) => {
      if (i > 0) pen += this.kern(glyphs[i - 1], g) + tracking;
      xs.push(pen);
      pen += this.advance(g);
    });
    const width = pen * scale;
    const anchor = options.anchor ?? 'start';
    const x0 = options.x - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
    const n = (v: number) => Math.round(v * 100) / 100;
    const parts: string[] = [];
    glyphs.forEach((g, i) => {
      const ox = x0 + xs[i] * scale;
      for (const contour of this.contours(g)) {
        parts.push(contourPath(contour, (q) => `${n(ox + q.x * scale)} ${n(options.y - q.y * scale)}`));
      }
    });
    return { d: parts.join(''), width };
  }

  /** The width a line would take, in pixels. */
  measure(text: string, size: number, tracking = 0): number {
    return this.set(text, { x: 0, y: 0, size, tracking }).width;
  }
}

/** A TrueType contour (quadratic, with implied on-curve midpoints) as SVG path data. */
function contourPath(points: Point[], at: (q: { x: number; y: number }) => string): string {
  if (points.length === 0) return '';
  const mid = (a: Point, c: Point): Point => ({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, on: true });
  const startIndex = points.findIndex((q) => q.on);
  let ring: Point[];
  let start: Point;
  if (startIndex >= 0) {
    ring = [...points.slice(startIndex + 1), ...points.slice(0, startIndex)];
    start = points[startIndex];
  } else {
    start = mid(points[points.length - 1], points[0]);
    ring = points;
  }
  let d = `M${at(start)}`;
  let control: Point | undefined;
  for (const q of [...ring, start]) {
    if (q.on) {
      d += control ? `Q${at(control)} ${at(q)}` : `L${at(q)}`;
      control = undefined;
    } else if (control) {
      const m = mid(control, q);
      d += `Q${at(control)} ${at(m)}`;
      control = q;
    } else {
      control = q;
    }
  }
  return `${d}Z`;
}

const loaded = new Map<string, Font>();

/** Loads a font file once. */
export function font(file: string): Font {
  let f = loaded.get(file);
  if (!f) {
    f = new Font(file);
    loaded.set(file, f);
  }
  return f;
}
