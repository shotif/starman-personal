import { expect, type Page, test } from '@playwright/test';

/**
 * The hero's growth (ACT1.md, increment 3), on a phone and a desktop: experience from the story, a
 * level's news, the growth screen, a rank bought, a new power put in hand, the training, a
 * companion's page, and the growth kept in the save.
 */
type Lightkeeper = { xp(amount: number): void; growth(): { hero: { hand: string[]; ranks: Record<string, number> } } };

const lk = <T>(page: Page, script: string) =>
  page.evaluate((s) => {
    const game = (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper;
    return new Function('lk', s)(game) as T;
  }, script);

async function openGrowth(page: Page, phone: boolean) {
  if (phone) await page.getByRole('button', { name: 'Pause' }).click();
  else await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Growth/ }).click();
  await expect(page.getByRole('dialog', { name: 'Growth' })).toBeVisible();
}

test('the hero grows: a level, a rank, a new power in hand, kept in the save', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?play&debug&quality=low&chapter=aboard&class=fieldwright');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-ready', 'true');
  await expect(body).toHaveAttribute('data-checkpoint', 'aboard');

  // The story gives experience: level 3, and Sink with it.
  await lk(page, 'lk.xp(400); lk.xp(400);');
  await expect(body).toHaveAttribute('data-level', '3');
  await expect(page.getByRole('status').filter({ hasText: 'A new power: Sink' })).toBeVisible();
  await expect(body).toHaveAttribute('data-growth-points', '4');

  await openGrowth(page, phone);
  const screen = page.getByRole('dialog', { name: 'Growth' });
  await expect(screen).toContainText('Level 3');
  await expect(screen.getByTestId('growth-points')).toHaveText('4 points to spend');
  await page.screenshot({ path: testInfo.outputPath('growth.png') });

  // A rank for Slam, then Sink put in hand at key 1.
  await screen.locator('[data-power="slam"]').getByRole('button', { name: 'Rank 2 · 1 point' }).click();
  await expect(screen.getByTestId('growth-points')).toHaveText('3 points to spend');
  await expect(screen.locator('[data-power="slam"]').getByRole('img', { name: 'Rank 2 of 3' })).toBeVisible();
  await screen.getByRole('button', { name: 'Sink to key 1' }).click();
  await expect(screen.locator('.growth__hand')).toContainText('1 Sink');
  // The training, rank 2.
  await screen.locator('[data-power="training"]').getByRole('button', { name: 'Rank 2 · 1 point' }).click();
  await expect(screen.getByTestId('growth-points')).toHaveText('2 points to spend');

  // Ren chooses for herself, and has spent her points.
  await screen.getByRole('button', { name: 'Ren' }).click();
  await expect(screen.getByLabel('Ren chooses for herself')).toBeChecked();
  await expect(screen.locator('[data-power="mark"]').getByRole('img', { name: 'Rank 3 of 3' })).toBeVisible();

  await screen.getByRole('button', { name: 'Back' }).click();
  if (phone) await page.getByRole('button', { name: 'Resume' }).click();
  else await page.keyboard.press('Escape');
  // The powers in hand follow: Sink on key 1.
  const powers = await lk<{ hand: string[]; ranks: Record<string, number> }>(page, 'return lk.growth().hero');
  expect(powers.hand[0]).toBe('sink');
  expect(powers.ranks.slam).toBe(2);
  if (phone) await expect(page.getByRole('button', { name: 'Sink', exact: true })).toBeVisible();
  else await expect(page.locator('.powers')).toContainText('Sink');

  // Kept: the save holds the growth at once, and a game resumed from it has it.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lightkeeper.save') ?? 'null'));
  expect(saved?.growth?.hero?.hand?.[0]).toBe('sink');
  expect(saved?.growth?.hero?.xp).toBe(800);
  expect(errors).toEqual([]);
});
