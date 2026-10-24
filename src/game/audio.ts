/**
 * The game's sound (D-23, D-45): effects placed in the world and heard from the camera, voices for
 * every line (the music dips under them; comms lines go through a radio's band), ambience by place,
 * and music that crossfades by mood. Plain Web Audio, started by the player's first touch or key
 * (browsers allow no sound before). Files come from manifests the asset scripts write
 * (public/assets/audio/audio.json, public/assets/voices/voices.json); anything missing is silence.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * A sound in the manifest. A loop plays from the top once, then between `loopStart` and `loopEnd`
 * (clear of the MP3's padding; a piece of music may loop only its later part).
 */
interface SoundEntry {
  file: string;
  seconds?: number;
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  volume?: number;
}

interface AudioManifest {
  sfx: Record<string, SoundEntry>;
  music: Record<string, SoundEntry>;
}

interface VoiceEntry {
  speaker?: string;
  file: string;
  seconds?: number;
  envelope?: number[];
  /** Playback gain that levels the line with the rest (quiet deliveries come out quiet). */
  gain?: number;
  radio?: boolean;
}

interface VoiceManifest {
  lines: Record<string, VoiceEntry>;
  hero?: Record<string, { man?: VoiceEntry; woman?: VoiceEntry }>;
}

export interface Playing {
  stop(fade?: number): void;
  setPosition(at: Vec3): void;
}

export interface Voice {
  seconds: number;
  /** The line's loudness now, 0 to 1, for lip sync. */
  level(): number;
  ended(): boolean;
  stop(): void;
}

export interface GameAudio {
  /** Starts the sound system; call from a user's touch or key. */
  unlock(): void;
  play(id: string, options?: { at?: Vec3; volume?: number; rate?: number; loop?: boolean }): Playing | null;
  /** A spoken line, by its id (the hero's in the hero's voice); null if it has no voice yet. */
  voice(lineId: string, heroBody: 'man' | 'woman'): Voice | null;
  /** The music for a mood; null for silence. Crossfades. */
  music(id: string | null): void;
  /** A looping ambience for a place; null for none. */
  ambience(id: string | null): void;
  /** Where the ears are, and which way they face. */
  listen(at: Vec3, forward: Vec3): void;
  setVolume(master: number): void;
  readonly ready: boolean;
}

const BASE = `${import.meta.env.BASE_URL}assets/`;
/** Babylon's world is left-handed and Web Audio's right-handed: mirroring z keeps left on the left. */
const z = (v: number) => -v;
const BUSES = { music: 0.42, sfx: 0.85, voice: 1, ambience: 0.38 };

export function createAudio(): GameAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const bus: Partial<Record<keyof typeof BUSES, GainNode>> = {};
  let manifest: AudioManifest | null = null;
  let voices: VoiceManifest | null = null;
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  let musicNow: { id: string; gain: GainNode; source: AudioBufferSourceNode } | null = null;
  let musicWanted: string | null = null;
  let ambienceNow: { id: string; gain: GainNode; source: AudioBufferSourceNode } | null = null;
  let ambienceWanted: string | null = null;
  let speaking = 0;

  // The manifests load at once; the sounds themselves when first needed.
  const loadJson = async <T>(path: string): Promise<T | null> => {
    try {
      const response = await fetch(`${BASE}${path}`);
      return response.ok ? ((await response.json()) as T) : null;
    } catch {
      return null;
    }
  };
  void loadJson<AudioManifest>('audio/audio.json').then((m) => {
    manifest = m;
    if (musicWanted) api.music(musicWanted);
    if (ambienceWanted) api.ambience(ambienceWanted);
  });
  void loadJson<VoiceManifest>('voices/voices.json').then((v) => {
    voices = v;
  });

  const buffer = (url: string): Promise<AudioBuffer | null> => {
    let b = buffers.get(url);
    if (!b) {
      b = (async () => {
        if (!context) return null;
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          return await context.decodeAudioData(await response.arrayBuffer());
        } catch {
          return null;
        }
      })();
      buffers.set(url, b);
    }
    return b;
  };

  /** Loops between the entry's loop points, where it has them. */
  const loopPoints = (source: AudioBufferSourceNode, entry: SoundEntry) => {
    if (entry.loopStart !== undefined) source.loopStart = entry.loopStart;
    if (entry.loopEnd !== undefined) source.loopEnd = entry.loopEnd;
  };

  /** A piece on a bus (music, ambience), faded in, looping unless it says not; its handle once it starts. */
  const loop = async (entry: SoundEntry, busName: keyof typeof BUSES, fadeIn: number) => {
    const b = await buffer(`${BASE}audio/${entry.file}`);
    if (!b || !context || !bus[busName]) return null;
    const source = context.createBufferSource();
    source.buffer = b;
    source.loop = entry.loop ?? true;
    loopPoints(source, entry);
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(entry.volume ?? 1, context.currentTime + fadeIn);
    source.connect(gain).connect(bus[busName] as GainNode);
    source.start();
    return { gain, source };
  };
  const fadeOut = (node: { gain: GainNode; source: AudioBufferSourceNode } | null, seconds: number) => {
    if (!node || !context) return;
    const now = context.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
    node.gain.gain.linearRampToValueAtTime(0, now + seconds);
    node.source.stop(now + seconds + 0.05);
  };

  /** The music bus dips while someone speaks. */
  const duck = () => {
    if (!context || !bus.music) return;
    const target = speaking > 0 ? BUSES.music * 0.45 : BUSES.music;
    bus.music.gain.setTargetAtTime(target, context.currentTime, 0.25);
  };

  const api: GameAudio = {
    get ready() {
      return context !== null;
    },
    unlock() {
      if (context) {
        if (context.state === 'suspended') void context.resume();
        return;
      }
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
      master = context.createGain();
      master.connect(context.destination);
      for (const [name, level] of Object.entries(BUSES) as [keyof typeof BUSES, number][]) {
        const g = context.createGain();
        g.gain.value = level;
        g.connect(master);
        bus[name] = g;
      }
      if (musicWanted) api.music(musicWanted);
      if (ambienceWanted) api.ambience(ambienceWanted);
    },
    play(id, options = {}) {
      const entry = manifest?.sfx[id];
      if (!context || !entry || !bus.sfx) return null;
      const ctx = context;
      const gain = ctx.createGain();
      gain.gain.value = (entry.volume ?? 1) * (options.volume ?? 1);
      let panner: PannerNode | null = null;
      if (options.at) {
        panner = ctx.createPanner();
        panner.panningModel = 'equalpower';
        panner.distanceModel = 'inverse';
        panner.refDistance = 2.5;
        panner.rolloffFactor = 1.1;
        panner.positionX.value = options.at.x;
        panner.positionY.value = options.at.y;
        panner.positionZ.value = z(options.at.z);
        gain.connect(panner).connect(bus.sfx);
      } else {
        gain.connect(bus.sfx);
      }
      let source: AudioBufferSourceNode | null = null;
      let stopped = false;
      void buffer(`${BASE}audio/${entry.file}`).then((b) => {
        if (!b || stopped) return;
        source = ctx.createBufferSource();
        source.buffer = b;
        source.loop = options.loop ?? entry.loop ?? false;
        if (source.loop) loopPoints(source, entry);
        source.playbackRate.value = options.rate ?? 1;
        source.connect(gain);
        source.start();
      });
      return {
        stop(fade = 0.1) {
          stopped = true;
          const now = ctx.currentTime;
          gain.gain.setTargetAtTime(0, now, fade / 3);
          source?.stop(now + fade + 0.05);
        },
        setPosition(at) {
          if (!panner) return;
          panner.positionX.value = at.x;
          panner.positionY.value = at.y;
          panner.positionZ.value = z(at.z);
        },
      };
    },
    voice(lineId, heroBody) {
      const entry = voices?.lines[lineId] ?? voices?.hero?.[lineId]?.[heroBody] ?? null;
      if (!context || !entry || !bus.voice) return null;
      const ctx = context;
      const gain = ctx.createGain();
      gain.gain.value = entry.gain ?? 1;
      let chain: AudioNode = gain;
      if (entry.radio) {
        // A comms band: the low and high ends cut, a little edge.
        const low = ctx.createBiquadFilter();
        low.type = 'highpass';
        low.frequency.value = 420;
        const high = ctx.createBiquadFilter();
        high.type = 'lowpass';
        high.frequency.value = 3200;
        gain.connect(low).connect(high);
        chain = high;
      }
      chain.connect(bus.voice);
      // Over comms, the click of the channel opening first.
      const delay = entry.radio ? 0.18 : 0;
      if (entry.radio) api.play('radio', { volume: 0.5 });
      const started = ctx.currentTime + delay;
      const seconds = entry.seconds ?? 2;
      let source: AudioBufferSourceNode | null = null;
      let done = false;
      speaking += 1;
      duck();
      const finish = () => {
        if (done) return;
        done = true;
        speaking = Math.max(0, speaking - 1);
        duck();
      };
      void buffer(`${BASE}voices/${entry.file}`).then((b) => {
        if (!b || done) {
          finish();
          return;
        }
        source = ctx.createBufferSource();
        source.buffer = b;
        source.connect(gain);
        source.onended = finish;
        source.start(started);
      });
      const envelope = entry.envelope ?? [];
      return {
        seconds,
        level() {
          const t = ctx.currentTime - started;
          if (done || t < 0 || t > seconds) return 0;
          if (envelope.length === 0) return 0.5 + 0.5 * Math.sin(t * 18);
          return envelope[Math.min(envelope.length - 1, Math.floor(t * 20))] ?? 0;
        },
        ended: () => done || ctx.currentTime - started > seconds + 0.3,
        stop() {
          source?.stop();
          finish();
        },
      };
    },
    music(id) {
      musicWanted = id;
      if (!context || !manifest) return;
      if (musicNow?.id === id) return;
      fadeOut(musicNow, 2.5);
      musicNow = null;
      const entry = id ? manifest.music[id] : null;
      if (!id || !entry) return;
      void loop(entry, 'music', 3).then((node) => {
        if (!node) return;
        if (musicWanted !== id) {
          fadeOut(node, 0.5);
          return;
        }
        musicNow = { id, ...node };
      });
    },
    ambience(id) {
      ambienceWanted = id;
      if (!context || !manifest) return;
      if (ambienceNow?.id === id) return;
      fadeOut(ambienceNow, 2);
      ambienceNow = null;
      const entry = id ? manifest.sfx[id] : null;
      if (!id || !entry) return;
      void loop(entry, 'ambience', 2).then((node) => {
        if (!node) return;
        if (ambienceWanted !== id) {
          fadeOut(node, 0.5);
          return;
        }
        ambienceNow = { id, ...node };
      });
    },
    listen(at, forward) {
      if (!context) return;
      const l = context.listener;
      if (l.positionX) {
        l.positionX.value = at.x;
        l.positionY.value = at.y;
        l.positionZ.value = z(at.z);
        l.forwardX.value = forward.x;
        l.forwardY.value = forward.y;
        l.forwardZ.value = z(forward.z);
        l.upX.value = 0;
        l.upY.value = 1;
        l.upZ.value = 0;
      }
    },
    setVolume(level) {
      if (master && context) master.gain.setTargetAtTime(level, context.currentTime, 0.05);
    },
  };
  return api;
}
