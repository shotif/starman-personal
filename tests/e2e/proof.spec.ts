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
  if (isPhone) {
    // The Run toggle acts on touch itself, since phones send no click while the stick is held.
    const run = page.getByRole('button', { name: 'Run' });
    await run.tap();
    await expect(run).toHaveAttribute('aria-pressed', 'true');
    await run.tap();
    await expect(run).toHaveAttribute('aria-pressed', 'false');
  }

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

test('Run toggles while the other thumb holds the stick', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'two-finger touch is a phone journey');
  await page.goto('./');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const run = page.getByRole('button', { name: 'Run' });
  const box = await run.boundingBox();
  if (!box) throw new Error('no Run button');
  const cdp = await page.context().newCDPSession(page);
  const thumb = { x: 80, y: 700, id: 1 };
  const pushed = { ...thumb, y: 630 };
  const finger = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pushed] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pushed, finger] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [pushed] });
  await expect(run).toHaveAttribute('aria-pressed', 'true');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});
