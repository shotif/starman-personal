import { expect, test } from '@playwright/test';

/** The proof starts on a phone and a desktop without errors and draws the corridor. */
test('the corridor starts and draws', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('./?play');
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
  await page.goto('./?play');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: testInfo.outputPath('walked.png') });
});

test('Run toggles while the other thumb holds the stick', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'two-finger touch is a phone journey');
  await page.goto('./?play');
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

test('aiming shows the crosshair and firing shoots', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?play');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  if (testInfo.project.name === 'phone') {
    await page.getByRole('button', { name: 'Aim' }).tap();
    await expect(page.locator('.crosshair')).toBeVisible();
    const fire = page.getByRole('button', { name: 'Fire' });
    const box = await fire.boundingBox();
    if (!box) throw new Error('no Fire button');
    const cdp = await page.context().newCDPSession(page);
    const finger = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
    await page.waitForTimeout(1200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: 'right' });
    await expect(page.locator('.crosshair')).toBeVisible();
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(1200);
    await page.mouse.up({ button: 'left' });
    await page.mouse.up({ button: 'right' });
  }
  await expect.poll(async () => Number(await page.locator('body').getAttribute('data-shots'))).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('aiming.png') });
  expect(errors).toEqual([]);
});

test('walking into the corridor crate takes cover', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the keyboard journey runs on the desktop');
  // The software renderer is slow: a small window at low quality keeps the frames coming.
  await page.setViewportSize({ width: 800, height: 500 });
  await page.goto('./?play&debug&quality=low');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.down('KeyW');
  await expect(page.getByText(/In cover/)).toBeVisible({ timeout: 60_000 });
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath('cover.png') });
  // Crouched, every part's bounds still hold the lowered head (the hair and eyes were culled by
  // their standing bounds), and the feet stand on the floor, not on air.
  const fit = await page.evaluate(() => {
    type Box = { minimumWorld: { y: number }; maximumWorld: { y: number } };
    type Node = { name: string; getAbsolutePosition(): { y: number }; position: { y: number } };
    type MeshLike = Node & { getTotalVertices(): number; getBoundingInfo(): { boundingBox: Box } };
    const { scene } = (window as unknown as { lightkeeper: { scene: { meshes: MeshLike[]; transformNodes: Node[] } } })
      .lightkeeper;
    const head = scene.transformNodes.find((n) => n.name === 'hero-head')?.getAbsolutePosition().y ?? Number.NaN;
    const parts = scene.meshes.filter((m) => m.name.startsWith('hero-') && m.getTotalVertices() > 0);
    const root = scene.transformNodes.find((n) => n.name === 'hero');
    return {
      head,
      parts: parts.length,
      holding: parts.filter((m) => {
        const box = m.getBoundingInfo().boundingBox;
        return box.minimumWorld.y < head && box.maximumWorld.y > head + 0.25;
      }).length,
      feet: root?.position.y ?? Number.NaN,
    };
  });
  expect(fit.head).toBeLessThan(1.2);
  expect(fit.parts).toBeGreaterThan(3);
  expect(fit.holding).toBe(fit.parts);
  expect(Math.abs(fit.feet)).toBeLessThan(0.02);
});

const said = (page: import('@playwright/test').Page) => page.locator('body').getAttribute('data-said');

test('orders: the command view opens, and Ren answers each order', async ({ page }, testInfo) => {
  await page.goto('./?play');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const dialog = page.getByRole('dialog', { name: 'Orders for Ren' });
  if (testInfo.project.name === 'phone') {
    await page.getByRole('button', { name: 'Orders' }).tap();
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: /Follow me/ }).tap();
  } else {
    await page.keyboard.press('KeyQ');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Digit3');
  }
  await expect(dialog).toBeHidden();
  // The line shows for under three seconds, so it is looked for on screen first: on a slow software
  // renderer, waiting for the page attribute first could find it gone.
  await expect(page.getByRole('status')).toContainText('Ren: With you.');
  expect(await said(page)).toBe('With you.');
});

test('orders: Ren attacks a drone until it is down', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the keyboard journey runs on the desktop');
  await page.setViewportSize({ width: 800, height: 500 });
  await page.goto('./?play&debug&quality=low');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  // Stand in the room looking level at the middle drone.
  await page.evaluate(() =>
    (
      window as unknown as { lightkeeper: { teleport(x: number, z: number, yaw: number, beta: number): void } }
    ).lightkeeper.teleport(0.8, 29, 0, 1.6),
  );
  await page.waitForTimeout(1000);
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('Digit2');
  await expect.poll(() => said(page)).toBe('On it.');
  await expect.poll(() => said(page), { timeout: 60_000 }).toBe('Target down.');
  await page.screenshot({ path: testInfo.outputPath('attack.png') });
});

test('talking to Ren: every line and choice, to the end', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?play');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const phone = testInfo.project.name === 'phone';
  // The hero starts beside Ren, so the prompt is there from the start.
  if (phone) await page.getByRole('button', { name: 'Talk' }).tap();
  else {
    await expect(page.getByText('Talk to Ren')).toBeVisible();
    await page.keyboard.press('KeyE');
  }
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-talking', 'true');
  if (phone) await expect(page.getByRole('button', { name: 'Fire' })).toBeHidden();
  const heard: string[] = [];
  for (let step = 0; step < 20; step += 1) {
    if ((await body.getAttribute('data-talking')) === 'false') break;
    const line = (await body.getAttribute('data-line')) ?? '';
    heard.push(line);
    if (step === 0) await page.screenshot({ path: testInfo.outputPath('talking.png') });
    // A tap is ignored for a moment after a new line, so one meant for the line before cannot skip it.
    await page.waitForTimeout(400);
    if (line === 'choices') {
      if (heard.filter((l) => l === 'choices').length === 1) {
        await page.screenshot({ path: testInfo.outputPath('choosing.png') });
      }
      if (phone) await page.locator('.dialogue__choice').first().tap();
      else await page.keyboard.press('Digit1');
    } else if (phone) await page.locator('.dialogue--line').tap();
    else await page.keyboard.press('Space');
    await expect(body).not.toHaveAttribute('data-line', line);
  }
  expect(heard.slice(0, 4)).toEqual(['ren_range_01', 'choices', 'hero_range_02a', 'ren_range_03a']);
  expect(heard).toContain('ren_range_06');
  await expect(body).toHaveAttribute('data-talking', 'false');
  if (phone) await expect(page.getByRole('button', { name: 'Fire' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the creator makes a hero, who then plays', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const press = (locator: import('@playwright/test').Locator) =>
    testInfo.project.name === 'phone' ? locator.tap() : locator.click();
  /** The creator's choices are radio buttons hidden inside labels drawn as buttons: press the label. */
  const pick = (name: string | RegExp) => press(page.locator('label', { has: page.getByRole('radio', { name }) }));
  await page.goto('./?creator');
  await expect(page.getByRole('heading', { name: 'Create your hero' })).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-creator', 'ready', { timeout: 60_000 });
  await page.getByPlaceholder("Your hero's name").fill('Ada');
  await pick('Woman');
  await pick(/Spacer/);
  await press(page.getByRole('tab', { name: 'Class' }));
  await pick('Warden');
  await press(page.getByRole('tab', { name: 'Past' }));
  await pick('Borderer');
  await pick('The hard call');
  await press(page.getByRole('tab', { name: 'Hair' }));
  await pick('Long');
  await press(page.getByRole('tab', { name: 'Eyes' }));
  await pick('Green');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('creator.png') });
  await press(page.getByRole('button', { name: 'Start' }));
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Change hero' })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lightkeeper.hero') ?? 'null'));
  expect(saved).toMatchObject({
    name: 'Ada',
    body: 'woman',
    lineage: 'spacer',
    heroClass: 'warden',
    origin: 'borderer',
    moment: 'hard-call',
    hair: 'long',
    eyes: 'green',
  });
  await expect(page.getByText('Ada · Warden')).toBeVisible();
  expect(errors).toEqual([]);
});
