import { expect, type Page, test } from '@playwright/test';

/**
 * Journeys through Calder Station on a phone and a desktop (D-02): starting, moving, cover, aiming,
 * orders, talking, the swarm, falling and being helped up, the title and the creator.
 */
type Lightkeeper = {
  teleport(x: number, z: number, yaw: number, beta: number, y?: number): void;
  wake(count: number, kind?: string): void;
  hurt(amount: number): void;
  fight(id: string): void;
  event(name: string): void;
  state(): {
    cover: { inCover: boolean };
    condition: { kind: string };
    area: string | null;
    swarm: { live: number; down: number };
  };
};
const debug = (page: Page) => page.evaluate.bind(page);
/**
 * CI's machines draw in software at a few frames a second, too slow for journeys that walk, aim or
 * fight in real time; those run on a real GPU (the owner's Mac) before every push.
 */
const SOFTWARE_GPU = !!process.env.CI;
const call = <T>(page: Page, fn: (lk: Lightkeeper) => T) =>
  debug(page)((source) => {
    const lk = (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper;
    return new Function('lk', `return (${source})(lk)`)(lk) as T;
  }, fn.toString());

async function start(page: Page, query = '?play&debug&quality=low') {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`./${query}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return errors;
}

test('the station starts, with the objective and the controls for the device', async ({ page }, testInfo) => {
  const errors = await start(page, '?play');
  await expect(page.locator('body')).toHaveAttribute('data-objective', 'Find Ren in the lounge');
  await expect(page.getByText('Find Ren in the lounge')).toBeVisible();
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
  await page.screenshot({ path: testInfo.outputPath('start.png') });
  expect(errors).toEqual([]);
});

test('Run toggles while the other thumb holds the stick', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'two-finger touch is a phone journey');
  await start(page, '?play');
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

test('the hero walks out of the bunk room on the keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'keyboard journey runs on the desktop');
  test.skip(SOFTWARE_GPU, 'walking in real time needs a GPU');
  await start(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  const feet = await call(page, (lk) => (lk.state() as unknown as { feet: number[] }).feet);
  expect(Math.hypot((feet[0] ?? 0) + 7.2, (feet[2] ?? 0) - 3.4)).toBeGreaterThan(1.5);
});

test('aiming shows the crosshair, and shots bring a drone down', async ({ page }, testInfo) => {
  test.skip(SOFTWARE_GPU, 'shooting in real time needs a GPU');
  const errors = await start(page);
  // In the range, facing the middle drone.
  await call(page, (lk) => lk.teleport(1.5, 24, 0, 1.6));
  await page.waitForTimeout(600);
  if (testInfo.project.name === 'phone') {
    await page.getByRole('button', { name: 'Aim' }).tap();
    await expect(page.locator('.crosshair')).toBeVisible();
    const fire = page.getByRole('button', { name: 'Fire' });
    const box = await fire.boundingBox();
    if (!box) throw new Error('no Fire button');
    const cdp = await page.context().newCDPSession(page);
    const finger = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
    await page.waitForTimeout(2000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('no canvas');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button: 'right' });
    await expect(page.locator('.crosshair')).toBeVisible();
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(2000);
    await page.mouse.up({ button: 'left' });
    await page.mouse.up({ button: 'right' });
  }
  await page.screenshot({ path: testInfo.outputPath('aim.png') });
  expect(errors).toEqual([]);
});

test('walking into a low crate takes cover, crouched whole, feet on the floor', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the keyboard journey runs on the desktop');
  await start(page);
  // South of the low crate at (3.5, 25.4), facing it.
  await call(page, (lk) => lk.teleport(3.5, 23.4, 0, 1.4));
  await page.keyboard.down('KeyW');
  await expect.poll(() => call(page, (lk) => lk.state().cover.inCover), { timeout: 20_000 }).toBe(true);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(1500);
  expect(await call(page, (lk) => lk.state().cover.inCover)).toBe(true);
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
    // The figure's own parts; the sidearm in the hand (hero-held-…) is not one.
    const parts = scene.meshes.filter(
      (m) => m.name.startsWith('hero-') && !m.name.startsWith('hero-held') && m.getTotalVertices() > 0,
    );
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

test('orders: the command view opens, and Ren answers', async ({ page }, testInfo) => {
  await start(page);
  // Ren follows once her first conversation is had; the range chapter starts with her following.
  await page.goto('./?chapter=range&debug&quality=low');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const dialog = page.getByRole('dialog', { name: 'Orders' });
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
  await expect(page.getByRole('status')).toContainText('With you.');
});

test('talking to Ren in the lounge, every line to the end', async ({ page }, testInfo) => {
  const errors = await start(page);
  await call(page, (lk) => lk.teleport(-1.2, 11, -Math.PI / 2, 1.4));
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-prompt', 'Talk to Ren');
  const phone = testInfo.project.name === 'phone';
  if (phone) await page.getByRole('button', { name: 'Talk to Ren' }).tap();
  else await page.keyboard.press('KeyE');
  await expect(body).toHaveAttribute('data-talking', 'true');
  const heard: string[] = [];
  for (let step = 0; step < 30; step += 1) {
    if ((await body.getAttribute('data-talking')) === 'false') break;
    const line = (await body.getAttribute('data-line')) ?? '';
    heard.push(line);
    if (step === 0) {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: testInfo.outputPath('talking.png') });
    }
    // A tap is ignored for a moment after a new line, so one meant for the line before cannot skip it.
    await page.waitForTimeout(400);
    if (line === 'choices') {
      if (phone) await page.locator('.dialogue__choice').first().tap();
      else await page.keyboard.press('Digit1');
    } else if (phone) await page.locator('.dialogue--line').tap();
    else await page.keyboard.press('Space');
    await expect(body).not.toHaveAttribute('data-line', line);
  }
  expect(heard.slice(0, 3)).toEqual(['ren_night_01', 'choices', 'hero_ren_night_02a']);
  expect(heard).toContain('ren_night_09');
  await expect(body).toHaveAttribute('data-objective', 'Run the drill on the range');
  expect(errors).toEqual([]);
});

test('the swarm shoots back; down, Ren comes and helps the hero up', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the long journey runs on the desktop');
  test.skip(SOFTWARE_GPU, 'a fight in real time needs a GPU');
  const errors = await start(page, '?chapter=concourse&debug&quality=low');
  const body = page.locator('body');
  // Into the concourse: the fight begins.
  await call(page, (lk) => lk.teleport(29, 25, 0, 1.4));
  await expect(page.getByText(/Contacts! High/)).toBeVisible({ timeout: 20_000 });
  await expect.poll(async () => Number(await body.getAttribute('data-hits')), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('swarm.png') });
  // Down: Ren comes, kneels, and the hero gets up (rising is the helped-up way back).
  await call(page, (lk) => lk.hurt(400));
  await expect(body).toHaveAttribute('data-condition', 'down');
  await expect(page.getByText('You’re down')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('down.png') });
  await expect(body).toHaveAttribute('data-condition', 'up', { timeout: 15_000 });
  // Helped up at half health, with a moment's grace from the swarm's shots.
  expect(Number(await body.getAttribute('data-health'))).toBe(0.5);
  await page.screenshot({ path: testInfo.outputPath('helped.png') });
  // Down again in the same fight: no second help, back to just before the fight.
  await call(page, (lk) => lk.hurt(400));
  await expect(body).toHaveAttribute('data-condition', 'down');
  await expect(body).toHaveAttribute('data-condition', 'up', { timeout: 15_000 });
  expect(Number(await body.getAttribute('data-health'))).toBe(1);
  expect(errors).toEqual([]);
});

test('the title offers a new game, which opens the creator; a hero made there plays', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const press = (locator: import('@playwright/test').Locator) =>
    testInfo.project.name === 'phone' ? locator.tap() : locator.click();
  /** The creator's choices are radio buttons hidden inside labels drawn as buttons: press the label. */
  const pick = (name: string | RegExp) => press(page.locator('label', { has: page.getByRole('radio', { name }) }));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Lightkeeper' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('title.png') });
  await press(page.getByRole('button', { name: 'New game' }));
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
  await press(page.getByRole('button', { name: 'Start' }));
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.locator('body')).toHaveAttribute('data-checkpoint', 'night_shift');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lightkeeper.save') ?? 'null'));
  expect(saved).toMatchObject({
    version: 1,
    checkpoint: 'night_shift',
    looks: { name: 'Ada', body: 'woman', heroClass: 'warden', origin: 'borderer', hair: 'long', eyes: 'green' },
  });
  // Back to the title: Continue now offers the saved game.
  await press(page.getByRole('button', { name: 'Pause' }));
  await press(page.getByRole('button', { name: 'Save and quit to title' }));
  await expect(page.getByRole('button', { name: /Continue/ })).toContainText('Ada · Night shift');
  expect(errors).toEqual([]);
});
