import { expect, type Page, test } from '@playwright/test';

/**
 * The Banked in a fight (ACT1.md increment 4; COMBAT.md, *The Banked*), on Calder's range with
 * `?banked`: they come in, take cover and fire; the warden's barrier holds from the front and not
 * from behind; a shield stops field powers; the engineer shields an ally; the fight ends when they
 * are down. The rules have unit tests; these are the people in the world.
 */
type Banked = {
  id: number;
  kind: string;
  at: number[];
  mode: string;
  health: number;
  shield: number;
  barrier: number;
  crouched: boolean;
  pulled: boolean;
};
const lk = <T>(page: Page, body: string): Promise<T> =>
  page.evaluate((s) => new Function('lk', s)((window as unknown as { lightkeeper: unknown }).lightkeeper), body);
const squad = (page: Page) => lk<Banked[]>(page, 'return lk.banked()');

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'their rules are the same on both; the phone runs the hero’s journeys');
});

async function start(page: Page, alone = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?play&debug&quality=low&chapter=range&class=fieldwright&banked');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  // Without Ren, who would otherwise bring them down before they show what they do.
  if (alone) await lk(page, "lk.standDown('ren')");
  await expect.poll(async () => (await squad(page)).length, { timeout: 15_000 }).toBeGreaterThan(0);
  return errors;
}

test('a squad comes in, takes cover and fires on the hero', async ({ page }, testInfo) => {
  const errors = await start(page);
  // Someone in cover, crouched at a point, within twenty seconds; and the hero hit.
  await expect
    .poll(async () => (await squad(page)).some((b) => b.crouched || b.mode === 'peek'), { timeout: 20_000 })
    .toBe(true);
  await expect
    .poll(async () => Number((await page.locator('body').getAttribute('data-hits')) ?? 0), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('banked.png') });
  expect(errors).toEqual([]);
});

test('the warden’s barrier holds from the front, not from behind', async ({ page }) => {
  const errors = await start(page);
  await lk(page, "lk.callBanked(['warden'])");
  await expect.poll(async () => (await squad(page)).some((b) => b.kind === 'warden')).toBe(true);
  await page.waitForTimeout(1500);
  const warden = (await squad(page)).find((b) => b.kind === 'warden') as Banked;
  // In front of it (it faces the hero): the barrier takes the blow, its health does not.
  const before = warden;
  await lk(page, `lk.strikeBanked(${warden.id}, 60)`);
  let now = (await squad(page)).find((b) => b.id === warden.id) as Banked;
  expect(now.barrier).toBeLessThan(before.barrier);
  expect(now.health).toBe(before.health);
  // From behind: past the barrier, onto plate and health.
  const at = now.at;
  await lk(page, `lk.teleport(${at[0]}, ${(at[2] ?? 0) + 4}, Math.PI, 1.4)`);
  await page.waitForTimeout(100);
  const behind = (await squad(page)).find((b) => b.id === warden.id) as Banked;
  await lk(page, `lk.strikeBanked(${warden.id}, 200, 'blast')`);
  now = (await squad(page)).find((b) => b.id === warden.id) as Banked;
  expect(now.health).toBeLessThan(behind.health);
  expect(errors).toEqual([]);
});

test('a shield stops a field power; down, it lifts', async ({ page }) => {
  const errors = await start(page);
  const trooper = (await squad(page)).find((b) => b.kind === 'trooper') as Banked;
  await lk(page, `lk.affectBanked(${trooper.id}, 'lift', 3)`);
  expect((await squad(page)).find((b) => b.id === trooper.id)?.pulled).toBe(false);
  // Overloaded: the shield gone (arc does double to it).
  await lk(page, `lk.strikeBanked(${trooper.id}, 40, 'arc')`);
  const stripped = (await squad(page)).find((b) => b.id === trooper.id) as Banked;
  expect(stripped.shield).toBe(0);
  await lk(page, `lk.affectBanked(${trooper.id}, 'lift', 3)`);
  expect((await squad(page)).find((b) => b.id === trooper.id)?.pulled).toBe(true);
  expect(errors).toEqual([]);
});

test('the engineer shields an ally whose shield is down', async ({ page }) => {
  const errors = await start(page, true);
  await expect.poll(async () => (await squad(page)).some((b) => b.kind === 'engineer')).toBe(true);
  const trooper = (await squad(page)).find((b) => b.kind === 'trooper') as Banked;
  await lk(page, `lk.strikeBanked(${trooper.id}, 40, 'arc')`);
  expect((await squad(page)).find((b) => b.id === trooper.id)?.shield).toBe(0);
  // Within the engineer's twelve seconds (the shield's own return takes a few seconds untouched, so
  // keep it under fire: a small blow each second).
  await expect
    .poll(
      async () => {
        await lk(page, `lk.strikeBanked(${trooper.id}, 0.01, 'kinetic')`);
        return (await squad(page)).find((b) => b.id === trooper.id)?.shield ?? 0;
      },
      { timeout: 16_000, intervals: [1000] },
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the fight ends when the Banked are down', async ({ page }) => {
  const errors = await start(page);
  for (let wave = 0; wave < 2; wave++) {
    await expect.poll(async () => (await squad(page)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    // The Banked, and any motes the engineer sent: the fight is everyone.
    await lk(page, 'lk.downAll()');
    await page.waitForTimeout(500);
  }
  await expect
    .poll(() => lk<{ fight: string | null }>(page, 'return lk.state()').then((s) => s.fight), { timeout: 15_000 })
    .toBeNull();
  expect(errors).toEqual([]);
});
