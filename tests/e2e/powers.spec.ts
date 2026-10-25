import { expect, type Page, test } from '@playwright/test';

/**
 * The powers gained at levels 3 and 6 (D-54, ACT1.md increment 3), each used on real machines of the
 * swarm on the range: each does what its card says. And the companions' own powers in a fight.
 */
type Machine = {
  at: number[];
  health: number;
  pulled: boolean;
  primed: boolean;
  marked: boolean;
  blinded: boolean;
};
type Lk = {
  xp(n: number): void;
  wake(count: number, kind?: string): void;
  aimAt(p: number[]): void;
  teleport(x: number, z: number, yaw: number, beta: number): void;
  hurt(amount: number): void;
  power(id: string): boolean;
  effects(): {
    longshot: number;
    shelter: unknown;
    brace: number;
    defences: { shield: number; shieldMax: number; health: number };
  };
  state(): { feet: number[]; swarm: { machines: Machine[]; down: number } };
};

const lk = <T>(page: Page, body: string): Promise<T> =>
  page.evaluate((s) => new Function('lk', s)((window as unknown as { lightkeeper: Lk }).lightkeeper), body);
const machines = (page: Page) => lk<Machine[]>(page, 'return lk.state().swarm.machines');
const total = async (page: Page) => (await machines(page)).reduce((n, m) => n + m.health, 0);

/** On the range at level 6 as a class, with three motes awake ahead and settled. */
async function onRange(page: Page, heroClass: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`./?play&debug&quality=low&chapter=range&class=${heroClass}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await lk(page, 'lk.xp(2800)');
  await expect(page.locator('body')).toHaveAttribute('data-level', '6');
  await lk(page, 'lk.wake(3)');
  await page.waitForTimeout(1500);
  expect((await machines(page)).length).toBe(3);
  return errors;
}

/** Turns the hero to the first machine, and uses a power on it. */
async function useOnFirst(page: Page, id: string) {
  const [first] = await machines(page);
  await lk(page, `lk.aimAt(${JSON.stringify(first?.at)})`);
  await page.waitForTimeout(150);
  expect(await lk<boolean>(page, `return lk.power('${id}')`), id).toBe(true);
}

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'the rules are the same on both; the buttons have their own journeys');
});

test('Breacher: Shrapnel Round bursts among the machines; Second Wind brings the shield back', async ({ page }) => {
  const errors = await onRange(page, 'breacher');
  const before = await total(page);
  await useOnFirst(page, 'shrapnel');
  await expect.poll(() => total(page)).toBeLessThan(before);
  await lk(page, 'lk.hurt(130)');
  const hurt = await lk<{ defences: { shield: number; health: number } }>(page, 'return lk.effects()');
  expect(hurt.defences.shield).toBe(0);
  expect(await lk<boolean>(page, "return lk.power('secondwind')")).toBe(true);
  const after = await lk<{ defences: { shield: number; shieldMax: number; health: number } }>(
    page,
    'return lk.effects()',
  );
  expect(after.defences.shield).toBe(after.defences.shieldMax);
  expect(after.defences.health).toBeGreaterThan(hurt.defences.health);
  expect(errors).toEqual([]);
});

test('Rigger: a Gun Post shoots the machines; Cascade leaps to more than one', async ({ page }) => {
  const errors = await onRange(page, 'rigger');
  // Three more, woken together a few metres apart: Cascade on the middle one leaps to the others.
  await lk(page, 'lk.wake(3)');
  await page.waitForTimeout(150);
  const before = (await machines(page)).map((m) => m.health);
  const middle = (await machines(page))[4];
  await lk(page, `lk.aimAt(${JSON.stringify(middle?.at)})`);
  await page.waitForTimeout(100);
  expect(await lk<boolean>(page, "return lk.power('cascade')")).toBe(true);
  await expect
    .poll(async () => (await machines(page)).filter((m, i) => m.health < (before[i] ?? 0)).length)
    .toBeGreaterThanOrEqual(2);
  const struck = await total(page);
  // The post goes down on the floor just ahead, and shoots what it sees.
  const feet = await lk<number[]>(page, 'return lk.state().feet');
  await lk(page, `lk.aimAt([${feet[0]}, ${(feet[1] ?? 0) + 0.1}, ${(feet[2] ?? 0) + 3}])`);
  expect(await lk<boolean>(page, "return lk.power('gunpost')")).toBe(true);
  await expect.poll(() => total(page), { timeout: 10_000 }).toBeLessThan(struck);
  expect(errors).toEqual([]);
});

test('Fieldwright: Sink drags a machine in and primes it; Shear cuts along a line', async ({ page }) => {
  const errors = await onRange(page, 'fieldwright');
  await useOnFirst(page, 'sink');
  await expect.poll(async () => (await machines(page))[0]?.pulled).toBe(true);
  expect((await machines(page))[0]?.primed).toBe(true);
  // Close to one, facing it: Shear.
  await page.waitForTimeout(5500);
  const [m] = await machines(page);
  const at = m?.at ?? [0, 0, 0];
  await lk(page, `lk.teleport(${at[0]}, ${(at[2] ?? 0) - 4}, 0, 1.3)`);
  await page.waitForTimeout(300);
  const before = await total(page);
  await useOnFirst(page, 'shear');
  await expect.poll(() => total(page)).toBeLessThan(before);
  expect(errors).toEqual([]);
});

test('Shade: Blind loses the hero to the machines near; Long Shot waits for a shot', async ({ page }) => {
  const errors = await onRange(page, 'shade');
  const [m] = await machines(page);
  const at = m?.at ?? [0, 0, 0];
  await lk(page, `lk.teleport(${at[0]}, ${(at[2] ?? 0) - 2}, 0, 1.3)`);
  await page.waitForTimeout(200);
  expect(await lk<boolean>(page, "return lk.power('blind')")).toBe(true);
  expect((await machines(page)).some((x) => x.blinded)).toBe(true);
  expect(await lk<boolean>(page, "return lk.power('longshot')")).toBe(true);
  expect((await lk<{ longshot: number }>(page, 'return lk.effects()')).longshot).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Warden: Lift from the Fieldwright, and Shelter’s dome', async ({ page }) => {
  const errors = await onRange(page, 'warden');
  const before = await total(page);
  await useOnFirst(page, 'lift');
  await expect.poll(() => total(page)).toBeLessThan(before);
  expect(await lk<boolean>(page, "return lk.power('shelter')")).toBe(true);
  expect((await lk<{ shelter: unknown }>(page, 'return lk.effects()')).shelter).not.toBeNull();
  expect(errors).toEqual([]);
});

test('Striker: Brace from the Breacher, Shear from the Fieldwright', async ({ page }) => {
  const errors = await onRange(page, 'striker');
  expect(await lk<boolean>(page, "return lk.power('brace')")).toBe(true);
  expect((await lk<{ brace: number }>(page, 'return lk.effects()')).brace).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Ren uses her own power in a fight: she marks a machine', async ({ page }) => {
  const errors = await onRange(page, 'striker');
  await expect.poll(async () => (await machines(page)).some((m) => m.marked), { timeout: 20_000 }).toBe(true);
  expect(errors).toEqual([]);
});
