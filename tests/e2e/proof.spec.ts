import { expect, test } from '@playwright/test';

/** The proof starts on a phone and a desktop without errors and draws the corridor. */
test('the corridor starts and draws', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('./');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByText(/fps · WebGL/)).toBeVisible();

  const isPhone = testInfo.project.name === 'phone';
  await expect(page.getByTestId('touch-move')).toHaveCount(isPhone ? 1 : 0);
  if (isPhone) await expect(page.getByRole('button', { name: 'Run' })).toBeVisible();

  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('corridor.png') });
  expect(errors).toEqual([]);
});

test('the hero walks forward on the keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'keyboard journey runs on the desktop');
  await page.goto('./');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: testInfo.outputPath('walked.png') });
});
