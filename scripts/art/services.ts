/**
 * The two paid services behind the art scripts, shared by concepts.ts, meshy.ts and models.ts:
 * Gemini for concept pictures and Meshy for image-to-3D. Keys come from env.ts and are never logged.
 */
import { requireKey } from './env.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One square 2K JPEG picture from Gemini's Interactions API (the request shape is Starman Control's).
 * `references` are JPEG pictures sent with the prompt, for example to show the same object from behind.
 */
export async function geminiPicture(model: string, prompt: string, references: Buffer[] = []): Promise<Buffer> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': requireKey('GEMINI_API_KEY') },
    body: JSON.stringify({
      model,
      input: [
        ...references.map((r) => ({ type: 'image', data: r.toString('base64'), mime_type: 'image/jpeg' })),
        { type: 'text', text: prompt },
      ],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '1:1', image_size: '2K' },
      store: false,
    }),
  });
  const json = (await response.json()) as {
    status?: string;
    steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(`Gemini: HTTP ${response.status} ${json.error?.message ?? ''}`);
  const image = (json.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((b) => b.type === 'image' && b.data)
    .at(-1);
  if (!image?.data) throw new Error(`Gemini: no image in the response (status ${json.status})`);
  return Buffer.from(image.data, 'base64');
}

const MESHY = 'https://api.meshy.ai/openapi/v1';
const meshyHeaders = () => ({
  Authorization: `Bearer ${requireKey('MESHY_API_KEY')}`,
  'Content-Type': 'application/json',
});

/** Meshy credits left, or null if the balance cannot be read. */
export async function meshyBalance(): Promise<number | null> {
  const response = await fetch(`${MESHY}/balance`, { headers: meshyHeaders() });
  if (!response.ok) return null;
  return ((await response.json()) as { balance?: number }).balance ?? null;
}

export interface MeshyResult {
  task: string;
  /** `image-to-3d` or `multi-image-to-3d`. */
  endpoint: string;
  credits: number | undefined;
  seconds: number;
  glb: Buffer;
}

/**
 * Turns JPEG pictures of one object into a model with Meshy and downloads its GLB: image-to-3D for
 * one picture, multi-image-to-3D for two to four views of the same object. `onTask` hears the task
 * id as soon as Meshy accepts it, so a record can be kept even if the wait fails.
 */
export async function meshyImageTo3d(
  pictures: Buffer[],
  settings: Record<string, unknown>,
  onTask?: (task: string) => void,
): Promise<MeshyResult> {
  const started = Date.now();
  const endpoint = pictures.length > 1 ? 'multi-image-to-3d' : 'image-to-3d';
  const urls = pictures.map((p) => `data:image/jpeg;base64,${p.toString('base64')}`);
  const created = await fetch(`${MESHY}/${endpoint}`, {
    method: 'POST',
    headers: meshyHeaders(),
    body: JSON.stringify({ ...(pictures.length > 1 ? { image_urls: urls } : { image_url: urls[0] }), ...settings }),
  });
  if (!created.ok) throw new Error(`Meshy: HTTP ${created.status} ${await created.text()}`);
  const { result: task } = (await created.json()) as { result: string };
  onTask?.(task);
  for (;;) {
    await sleep(10_000);
    const polled = await fetch(`${MESHY}/${endpoint}/${task}`, { headers: meshyHeaders() });
    if (!polled.ok) {
      if (polled.status >= 500) continue;
      throw new Error(`Meshy: HTTP ${polled.status} while polling ${task}`);
    }
    const state = (await polled.json()) as {
      status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
      consumed_credits?: number;
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    if (state.status === 'PENDING' || state.status === 'IN_PROGRESS') continue;
    if (state.status !== 'SUCCEEDED' || !state.model_urls?.glb) {
      throw new Error(`Meshy task ${task}: ${state.status} ${state.task_error?.message ?? ''}`);
    }
    const glb = Buffer.from(await (await fetch(state.model_urls.glb)).arrayBuffer());
    return {
      task,
      endpoint,
      credits: state.consumed_credits,
      seconds: Math.round((Date.now() - started) / 1000),
      glb,
    };
  }
}

/**
 * Remeshes a finished Meshy task to a new triangle count; Meshy bakes its textures again onto the new
 * mesh. For models made with more triangles than a phone needs (5 credits).
 */
export async function meshyRemesh(inputTask: string, targetPolycount: number): Promise<MeshyResult> {
  const started = Date.now();
  const created = await fetch(`${MESHY}/remesh`, {
    method: 'POST',
    headers: meshyHeaders(),
    body: JSON.stringify({
      input_task_id: inputTask,
      target_formats: ['glb'],
      topology: 'triangle',
      target_polycount: targetPolycount,
    }),
  });
  if (!created.ok) throw new Error(`Meshy remesh: HTTP ${created.status} ${await created.text()}`);
  const { result: task } = (await created.json()) as { result: string };
  for (;;) {
    await sleep(8_000);
    const polled = await fetch(`${MESHY}/remesh/${task}`, { headers: meshyHeaders() });
    if (!polled.ok) {
      if (polled.status >= 500) continue;
      throw new Error(`Meshy remesh: HTTP ${polled.status} while polling ${task}`);
    }
    const state = (await polled.json()) as {
      status: string;
      consumed_credits?: number;
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    if (state.status === 'PENDING' || state.status === 'IN_PROGRESS') continue;
    if (state.status !== 'SUCCEEDED' || !state.model_urls?.glb) {
      throw new Error(`Meshy remesh ${task}: ${state.status} ${state.task_error?.message ?? ''}`);
    }
    const glb = Buffer.from(await (await fetch(state.model_urls.glb)).arrayBuffer());
    return {
      task,
      endpoint: 'remesh',
      credits: state.consumed_credits,
      seconds: Math.round((Date.now() - started) / 1000),
      glb,
    };
  }
}
