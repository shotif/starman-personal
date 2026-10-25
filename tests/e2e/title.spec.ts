import { expect, test } from '@playwright/test';

/**
 * The journey CI plays (@ci): the title and the creator, on a phone and a desktop. CI's machines draw
 * in software, too slowly for the station itself; every other journey runs on a real GPU (the
 * owner's Mac) before each push.
 */
test('@ci the title shows its art and opens the creator, which shows a hero', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const press = (locator: import('@playwright/test').Locator) =>
    testInfo.project.name === 'phone' ? locator.tap() : locator.click();
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Lightkeeper' })).toBeVisible();
  // The key art has loaded (the wide or the tall one, by the screen's shape).
  await expect
    .poll(() => page.locator('.title__art img').evaluate((img: HTMLImageElement) => img.naturalWidth), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
  await press(page.getByRole('button', { name: 'New game' }));
  await expect(page.getByRole('heading', { name: 'Create your hero' })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-creator', 'ready', { timeout: 120_000 });
  await press(page.getByRole('tab', { name: 'Class' }));
  await expect(page.getByRole('radio', { name: 'Warden' })).toBeAttached();
  expect(errors).toEqual([]);
});
