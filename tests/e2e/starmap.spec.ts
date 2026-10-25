import { expect, type Page, test } from '@playwright/test';

/**
 * The star map on *Lantern*'s bridge (ACT1.md, increment 2), on a phone and a desktop (D-02):
 * opening it, turning and zooming it, choosing stars by a lead, a name and a tap, reading them, the
 * two later leads saying so, and setting the course that takes the ship into the lanes.
 */
type Lightkeeper = {
  teleport(x: number, z: number, yaw: number, beta: number, y?: number): void;
  event(name: string): void;
  state(): { waiting: string[] | null };
};
type MapView = {
  view(): { alpha: number; beta: number; radius: number };
  project(ids?: string[]): { id: string; x: number; y: number; depth: number }[];
};

const lk = (page: Page, script: string) =>
  page.evaluate((s) => {
    const game = (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper;
    return new Function('lk', s)(game);
  }, script);
const mapView = (page: Page) =>
  page.evaluate(() => (window as unknown as { lightkeeperMap: MapView }).lightkeeperMap.view());

/** Aboard, past the crew's conversations, at the star map; then opens it as the device does. */
async function openMap(page: Page, phone: boolean) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?play&debug&quality=low&chapter=aboard');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => lk(page, "return lk.state().waiting?.join('|')")).toBe('talked:ren_aboard');
  await lk(page, "lk.event('talked:ren_aboard'); lk.event('talked:jo_aboard'); lk.event('talked:pell_aboard');");
  await expect(body).toHaveAttribute('data-objective', 'Set a course on the star map');
  await lk(page, 'lk.teleport(2.5, -2.6, Math.PI, 1.4)');
  await expect(body).toHaveAttribute('data-prompt', 'Open the star map');
  if (phone) await page.getByRole('button', { name: 'Open the star map' }).dispatchEvent('pointerdown');
  else await page.keyboard.press('KeyE');
  await expect(body).toHaveAttribute('data-map', 'open');
  return errors;
}

test('the star map opens on the bridge and reads the neighbourhood', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  const errors = await openMap(page, phone);
  const panel = page.locator('.starmap__panel');
  // It opens on the open lead, with its course.
  await expect(panel.getByRole('heading', { name: 'Pyre' })).toBeVisible();
  await expect(panel).toContainText('By the old lanes: 11 jumps');
  await expect(panel).toContainText('the last from GJ 915');
  await expect(panel.getByRole('button', { name: 'Set course' })).toBeVisible();
  // While it is open the game's controls step aside.
  await expect(page.locator('.touch__talk')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('map-open.png') });

  // The two later leads say so honestly; the Duskfolk border is past the old lanes.
  await page.getByRole('button', { name: /Maw Roost/ }).click();
  await expect(panel.getByRole('heading', { name: 'Wolf 1061' })).toBeVisible();
  await expect(panel).toContainText('Later in Act 1.');
  await expect(panel.getByRole('button', { name: 'Set course' })).toHaveCount(0);
  await expect(panel).toContainText('Planets known: Wolf 1061 b (confirmed)');
  await page.getByRole('button', { name: /Duskfolk border/ }).click();
  await expect(panel.getByRole('heading', { name: 'GJ 433' })).toBeVisible();
  await expect(panel).toContainText('No old lane reaches it.');

  // Here: where Lantern is, as the archives have it.
  await page.getByRole('button', { name: 'Here' }).click();
  await expect(panel.getByRole('heading', { name: 'Ross 128' })).toBeVisible();
  await expect(panel).toContainText('Lantern is here');
  await expect(panel).toContainText('11.0 light-years from the Sun');
  await expect(panel).toContainText('Planets known: Ross 128 b (confirmed)');
  await expect(panel).toContainText('Its place: Gaia DR3');

  // A star chosen by its name on the map.
  await page.locator('.starmap__label', { hasText: 'Pyre Remnant' }).click();
  await expect(panel.getByRole('heading', { name: 'Pyre' })).toBeVisible();

  // Turned by a drag, zoomed by the wheel or a key.
  const before = await mapView(page);
  // From a point of bare map (a name there would take the press instead).
  const start = await page.evaluate(() => {
    const surface = document.querySelector('.starmap__surface');
    for (let y = 120; y < innerHeight / 2; y += 17) {
      for (let x = 40; x < innerWidth / 2; x += 23) {
        if (document.elementFromPoint(x, y) === surface && document.elementFromPoint(x + 90, y + 30) === surface) {
          return { x, y };
        }
      }
    }
    return null;
  });
  expect(start).not.toBeNull();
  await page.mouse.move(start?.x ?? 0, start?.y ?? 0);
  await page.mouse.down();
  await page.mouse.move((start?.x ?? 0) + 90, (start?.y ?? 0) + 30, { steps: 6 });
  await page.mouse.up();
  const turned = await mapView(page);
  expect(Math.abs(turned.alpha - before.alpha)).toBeGreaterThan(0.3);
  if (phone) {
    await page.mouse.wheel(0, -400);
  } else {
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');
  }
  await expect.poll(async () => (await mapView(page)).radius).toBeLessThan(turned.radius * 0.8);

  // A tap on a star chooses it: one nothing covers, and none other near it.
  await page.getByRole('button', { name: 'Here' }).click();
  await page.waitForTimeout(1200);
  const star = await page.evaluate(() => {
    const points = (window as unknown as { lightkeeperMap: MapView }).lightkeeperMap.project();
    const surface = document.querySelector('.starmap__surface');
    return (
      points.find(
        (p) =>
          p.depth > 0 &&
          p.id !== 'ross-128' &&
          document.elementFromPoint(p.x, p.y) === surface &&
          !points.some((q) => q !== p && q.depth > 0 && Math.hypot(q.x - p.x, q.y - p.y) < 34),
      ) ?? null
    );
  });
  expect(star).not.toBeNull();
  if (phone) await page.touchscreen.tap(star?.x ?? 0, star?.y ?? 0);
  else await page.mouse.click(star?.x ?? 0, star?.y ?? 0);
  await expect(page.locator('.starmap')).toHaveAttribute('data-chosen', star?.id ?? '');

  // Closed, the bridge is back and the map can be opened again.
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('body')).not.toHaveAttribute('data-map', 'open');
  await expect(page.locator('body')).toHaveAttribute('data-prompt', 'Open the star map');
  expect(errors).toEqual([]);
});

test('setting the course to Pyre Remnant takes Lantern into the lanes', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  const errors = await openMap(page, phone);
  await page.getByRole('button', { name: 'Set course' }).click();
  const body = page.locator('body');
  // Jo lays the course in.
  await expect(body).toHaveAttribute('data-talking', 'true');
  await expect(body).not.toHaveAttribute('data-map', 'open');
  for (let i = 0; i < 20 && (await body.getAttribute('data-talking')) === 'true'; i++) {
    const choices = page.locator('.dialogue__choice');
    if ((await body.getAttribute('data-line')) === 'choices') await choices.first().click();
    else await page.locator('.dialogue').click();
    await page.waitForTimeout(400);
  }
  // The leaving, watched; then the lane, saved, and Jo waiting to take her in to Pyre Remnant.
  await expect.poll(() => lk(page, "return lk.state().waiting?.join('|')")).toBe('done:depart');
  await page.screenshot({ path: testInfo.outputPath('leaving.png') });
  await expect(body).toHaveAttribute('data-checkpoint', 'lane', { timeout: 20_000 });
  await expect(body).toHaveAttribute('data-objective', 'Tell Jo when to take her in', { timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('the star map fits a tablet held upright', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the phone has its own size');
  await page.setViewportSize({ width: 820, height: 1180 });
  const errors = await openMap(page, false);
  const panel = page.locator('.starmap__panel');
  await expect(panel.getByRole('button', { name: 'Set course' })).toBeInViewport();
  // The leads, the panel and the bar do not cover each other.
  const leads = await page.locator('.starmap__leads').boundingBox();
  const sheet = await panel.boundingBox();
  const bar = await page.locator('.starmap__bar').boundingBox();
  expect((leads?.y ?? 0) + (leads?.height ?? 0)).toBeLessThan(sheet?.y ?? 0);
  expect((sheet?.y ?? 0) + (sheet?.height ?? 0)).toBeLessThanOrEqual((bar?.y ?? 0) + 1);
  await page.screenshot({ path: testInfo.outputPath('map-tablet.png') });
  expect(errors).toEqual([]);
});
