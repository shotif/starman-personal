import { expect, type Page, test } from '@playwright/test';

/**
 * The weapons (D-56; ACT1.md, increment 3), on a phone and a desktop: the armoury in Lantern's
 * store room, two carried and swapped, a mod found and fitted, and each kind firing as its numbers
 * say on the range.
 */
type Machine = { at: number[]; health: number };
type Lk = {
  teleport(x: number, z: number, yaw: number, beta: number): void;
  wake(count: number): void;
  aimAt(p: number[]): void;
  trigger(aim: boolean, fire: boolean): void;
  arm(kit: { weapons?: string[]; carried?: [string, string | null] }): void;
  kit(): { carried: [string, string | null]; mods: { id: string; on: string | null }[] };
  fov(): number;
  state(): { prompt: { label: string } | null; swarm: { machines: Machine[] } };
};
const lk = <T>(page: Page, body: string): Promise<T> =>
  page.evaluate((s) => new Function('lk', s)((window as unknown as { lightkeeper: Lk }).lightkeeper), body);

async function start(page: Page, query: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`./?play&debug&quality=low&${query}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return errors;
}

/** Walks up to a thing and uses it, as the device does. */
async function use(page: Page, phone: boolean, x: number, z: number, yaw: number, label: string) {
  await lk(page, `lk.teleport(${x}, ${z}, ${yaw}, 1.4)`);
  await expect(page.locator('body')).toHaveAttribute('data-prompt', label);
  if (phone) await page.getByRole('button', { name: label }).dispatchEvent('pointerdown');
  else await page.keyboard.press('KeyE');
}

test('the armoury: two weapons carried, swapped, and a mod found and fitted', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  const errors = await start(page, 'chapter=aboard&class=striker');

  // A find first: the old captain's scope, at his desk.
  await use(page, phone, 9, -4, -Math.PI / 2, "Take the old captain's scope");
  await expect(page.getByText('Found: Scope. Fit it at the armoury.')).toBeVisible();

  await use(page, phone, 25.4, -5, Math.PI, 'Open the armoury');
  const armoury = page.getByRole('dialog', { name: 'Armoury' });
  await expect(armoury).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('armoury.png') });
  // A Striker: rifle and shotgun, not the marksman rifle.
  await expect(armoury.locator('[data-weapon="marksman"]')).toContainText('Not trained: for Breachers and Shades.');
  await armoury.locator('[data-weapon="rifle"]').getByRole('button', { name: 'In hand' }).click();
  await armoury.locator('[data-weapon="shotgun"]').getByRole('button', { name: 'Second' }).click();
  await expect(armoury.getByTestId('carried')).toContainText('In hand: Rifle · second: Shotgun');
  await expect(armoury.getByTestId('carried')).toContainText('weight 4: your powers return 10% slower');
  // The scope fits the rifle.
  await armoury.locator('[data-mod="scope"]').getByRole('button', { name: 'Rifle', exact: true }).click();
  await expect(armoury.locator('[data-mod="scope"]')).toContainText('on the rifle');
  await armoury.getByRole('button', { name: 'Back' }).click();
  await expect(armoury).toHaveCount(0);

  // Swapped: X on a desktop, the button by Strike on a phone.
  if (phone) await page.getByRole('button', { name: 'Swap to Shotgun' }).dispatchEvent('pointerdown');
  else {
    await expect(page.locator('.powers__weapon')).toContainText('Rifle · X or the wheel: Shotgun');
    await page.keyboard.press('KeyX');
  }
  await expect
    .poll(async () => (await lk<{ carried: string[] }>(page, 'return lk.kit()')).carried)
    .toEqual(['shotgun', 'rifle']);
  // Kept in the save at once.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lightkeeper.save') ?? 'null'));
  expect(saved?.kit?.carried).toEqual(['shotgun', 'rifle']);
  expect(saved?.kit?.mods).toEqual([{ id: 'scope', on: 'rifle' }]);
  expect(errors).toEqual([]);
});

test('each kind fires as its numbers say', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the rules are the same on both');
  const errors = await start(page, 'chapter=range&class=breacher');
  const all = ['pistol', 'rifle', 'shotgun', 'marksman'];
  // The marksman rifle narrows the view far more than the pistol when aiming.
  await lk(page, `lk.arm({ weapons: ${JSON.stringify(all)}, carried: ['pistol', 'marksman'] })`);
  await lk(page, 'lk.trigger(true, false)');
  await page.waitForTimeout(700);
  const pistolFov = await lk<number>(page, 'return lk.fov()');
  await lk(page, "lk.arm({ carried: ['marksman', 'pistol'] })");
  await page.waitForTimeout(700);
  const marksmanFov = await lk<number>(page, 'return lk.fov()');
  expect(marksmanFov).toBeLessThan(pistolFov * 0.7);

  // The shotgun, close: eight slugs at a mote take most of it at once.
  await lk(page, "lk.arm({ carried: ['shotgun', 'pistol'] })");
  await lk(page, 'lk.wake(1)');
  await page.waitForTimeout(1200);
  const [mote] = await lk<Machine[]>(page, 'return lk.state().swarm.machines');
  const at = mote?.at ?? [0, 0, 0];
  await lk(page, `lk.teleport(${at[0]}, ${(at[2] ?? 0) - 4}, 0, 1.3)`);
  await page.waitForTimeout(200);
  await lk(page, `lk.aimAt(${JSON.stringify(at)})`);
  const before = mote?.health ?? 0;
  await lk(page, 'lk.trigger(true, true)');
  await page.waitForTimeout(150);
  await lk(page, 'lk.trigger(true, false)');
  await expect
    .poll(async () => (await lk<Machine[]>(page, 'return lk.state().swarm.machines'))[0]?.health ?? 0)
    .toBeLessThan(before * 0.5);
  expect(errors).toEqual([]);
});

test('every weapon points where the crosshair looks, and a long gun is held to the shoulder', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the hold is the same on both');
  const errors = await start(page, 'chapter=range&class=breacher');
  await lk(page, "lk.arm({ weapons: ['pistol', 'rifle', 'shotgun', 'marksman'], carried: ['pistol', null] })");
  await lk(page, 'lk.teleport(0, 23.5, Math.PI / 2, 1.5)');
  await lk(page, 'lk.trigger(true, false)');
  for (const kind of ['pistol', 'rifle', 'shotgun', 'marksman']) {
    await lk(page, `lk.arm({ carried: ['${kind}', null] })`);
    await page.waitForTimeout(700);
    // The gun's barrel against the camera's look (the hand's animation turned it 45° to the right
    // before: the owner, 25 October 2026).
    const angle = await page.evaluate(() => {
      const scene = (
        window as unknown as {
          lightkeeper: {
            scene: {
              activeCamera: { getTarget(): V; globalPosition: V };
              transformNodes: { name: string; isEnabled(): boolean; forward: V }[];
            };
          };
        }
      ).lightkeeper.scene;
      type V = { x: number; y: number; z: number; subtract(o: V): V; normalize(): V };
      const gun = scene.transformNodes.find((n) => n.name === 'hero-aimed' && n.isEnabled());
      if (!gun) return null;
      const look = scene.activeCamera.getTarget().subtract(scene.activeCamera.globalPosition).normalize();
      const f = gun.forward;
      return (Math.acos(Math.min(1, f.x * look.x + f.y * look.y + f.z * look.z)) * 180) / Math.PI;
    });
    expect(angle, kind).not.toBeNull();
    expect(angle ?? 180, kind).toBeLessThan(8);
    // The long guns are held two-handed to the shoulder; the pistol out in both hands.
    const clip = kind === 'pistol' ? 'hero-pistol_aim' : 'hero-rifle_aim';
    const weight = await page.evaluate(
      (name) =>
        (
          window as unknown as {
            lightkeeper: { scene: { animationGroups: { name: string; weight: number }[] } };
          }
        ).lightkeeper.scene.animationGroups.find((g) => g.name === name)?.weight ?? 0,
      clip,
    );
    expect(weight, kind).toBeGreaterThan(0.9);
  }
  expect(errors).toEqual([]);
});
