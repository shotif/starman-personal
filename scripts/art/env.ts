// API keys for the art scripts, from the environment or the git-ignored `.env` in the repository
// root. Only these build-time scripts read them; the game never sees them (D-28). Adapted from
// Starman Control's scripts/art/env.ts.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Parses `KEY=value` lines; blank lines and `#` comments are skipped, surrounding quotes removed. */
export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let dotEnv: Record<string, string> | undefined;

/** A setting from the environment first, then `.env`; undefined when neither has it. */
export function optionalKey(name: 'ELEVENLABS_API_BASE' | 'FFMPEG' | 'FFPROBE'): string | undefined {
  return setting(name);
}

function setting(name: string): string | undefined {
  if (!dotEnv) {
    const path = resolve(import.meta.dirname, '../../.env');
    dotEnv = existsSync(path) ? parseDotEnv(readFileSync(path, 'utf8')) : {};
  }
  return process.env[name] || dotEnv[name] || undefined;
}

/** The key's value, or an error naming the key (never its value). */
export function requireKey(name: 'GEMINI_API_KEY' | 'MESHY_API_KEY' | 'ELEVENLABS_API_KEY'): string {
  const value = setting(name);
  if (!value) throw new Error(`${name} is not set: add it to .env (see .env.example)`);
  return value;
}
