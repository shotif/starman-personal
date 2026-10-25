import { expect, test } from '@playwright/test';

/**
 * Inside the lane (D-70; ACT1_ART.md §5): Starman Reborn's tunnel of light, seen from *Lantern*'s
 * bridge, with the gate's glow ahead along her course.
 */
test('the lane is a tunnel of light round the ship, the gate ahead', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?play&debug&quality=low&chapter=lane');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-objective', 'Tell Jo when to take her in', {
    timeout: 30_000,
  });
  const drawn = await page.evaluate(() => {
    const scene = (
      window as unknown as { lightkeeper: { scene: { meshes: { name: string; isEnabled(): boolean }[] } } }
    ).lightkeeper.scene;
    return ['lane-tube', 'lane-gate'].map((n) => scene.meshes.some((m) => m.name === n && m.isEnabled()));
  });
  expect(drawn).toEqual([true, true]);
  await page.evaluate(() =>
    (window as unknown as { lightkeeper: { view(from: number[], to: number[]): void } }).lightkeeper.view(
      [2, 1.7, 0],
      [-8, 1.9, 0],
    ),
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath('lane.png') });
  expect(errors).toEqual([]);
});
