import { expect, type Page, test } from '@playwright/test';

/**
 * The slice from the night shift to the bridge (SLICE.md), played through the real game on a
 * desktop: walking up to people, talking, choosing, the scenes, the relay, the lift-off and the end.
 * The fights are won through the `?debug` hook (they have journeys of their own); everything else is
 * the game as a player has it.
 */
type Lightkeeper = {
  teleport(x: number, z: number, yaw: number, beta: number, y?: number): void;
  event(name: string): void;
  state(): { waiting: string[] | null; area: string | null; fight: string | null; prompt: { label: string } | null };
};

async function teleport(page: Page, x: number, z: number, yaw = 0, y = 0) {
  await page.evaluate(
    ([x, z, yaw, y]) => (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper.teleport(x, z, yaw, 1.4, y),
    [x, z, yaw, y],
  );
  await page.waitForTimeout(250);
}

const waiting = (page: Page) =>
  page.evaluate(() => (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper.state().waiting?.join('|') ?? '');

/** Reads a conversation through, choosing with `pick` (the first choice by default). */
async function talkThrough(page: Page, pick: (choices: string[]) => number = () => 0) {
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-talking', 'true');
  for (let i = 0; i < 80; i++) {
    if ((await body.getAttribute('data-talking')) !== 'true') return;
    const line = await body.getAttribute('data-line');
    if (line === 'choices') {
      const texts = await page.locator('.dialogue__choice').allInnerTexts();
      await page.keyboard.press(`Digit${pick(texts) + 1}`);
    } else {
      await page.keyboard.press('Space');
    }
    await page.waitForTimeout(40);
  }
  throw new Error('the conversation did not end');
}

/** Walks up to someone (by teleport), and talks when the prompt offers it. */
async function talkTo(page: Page, name: string, x: number, z: number, pick?: (choices: string[]) => number) {
  await teleport(page, x, z);
  await expect(page.locator('body')).toHaveAttribute('data-prompt', `Talk to ${name}`);
  await page.keyboard.press('KeyE');
  await talkThrough(page, pick);
}

async function win(page: Page, fight: string) {
  await expect.poll(() => waiting(page)).toBe(`cleared:${fight}`);
  await page.evaluate(
    (f) => (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper.event(`cleared:${f}`),
    fight,
  );
}

test('the slice plays from the night shift to the bridge', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the long journey runs on the desktop');
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./?play&debug&quality=low');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-ready', 'true');
  await expect(body).toHaveAttribute('data-objective', 'Find Ren in the lounge');

  // Night shift: the people of the lounge, then Ren.
  await talkTo(page, 'Ilya', 1.2, 4.8);
  await talkTo(page, 'Ren', -1.2, 11);
  await expect(body).toHaveAttribute('data-objective', 'Run the drill on the range', { timeout: 15_000 });

  // The range, the drill, and the lights going out.
  await teleport(page, 1, 22);
  // Three rounds: the drones, then with orders, then with powers.
  for (let round = 0; round < 3; round++) {
    await expect.poll(() => waiting(page), { timeout: 20_000 }).toBe('cleared:drill');
    if (round === 0) await page.screenshot({ path: testInfo.outputPath('1-range.png') });
    await page.evaluate(() => (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper.event('cleared:drill'));
  }
  await expect(body).toHaveAttribute('data-objective', 'Get to Control', { timeout: 30_000 });

  // Control: the chief's scene starts by itself.
  await teleport(page, 14, 7, Math.PI / 2);
  await teleport(page, 25, 7, Math.PI / 2);
  await talkThrough(page);
  await expect(body).toHaveAttribute('data-objective', 'Get through the concourse');
  await page.screenshot({ path: testInfo.outputPath('2-control.png') });

  // The concourse: a fight, then Pell, and the choice of the mast.
  await teleport(page, 29, 24);
  await win(page, 'concourse_1');
  await expect(body).toHaveAttribute('data-objective', 'Talk to Pell at the comms booth', { timeout: 15_000 });
  await talkTo(page, 'Pell', 39.2, 44, (choices) =>
    Math.max(
      0,
      choices.findIndex((c) => c.includes('mast')),
    ),
  );
  await expect(body).toHaveAttribute('data-objective', 'Get out to the relay mast');

  // The mast: out on the catwalk, a fight, then the relay by hand.
  await teleport(page, 50, 31, Math.PI / 2);
  await teleport(page, 58, 31, Math.PI / 2);
  await win(page, 'catwalk');
  await teleport(page, 93.6, 31.2, Math.PI / 2, 3);
  await expect(body).toHaveAttribute('data-prompt', 'Turn the relay', { timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath('3-mast.png') });
  await page.keyboard.press('KeyE');
  await expect(body).toHaveAttribute('data-objective', 'Get back to the clinic', { timeout: 30_000 });

  // Back to the clinic: a fight in the concourse, and the cost.
  await teleport(page, 40, 31, -Math.PI / 2);
  await win(page, 'clinic');
  await talkThrough(page);
  await expect(body).toHaveAttribute('data-objective', 'Into the hangar', { timeout: 30_000 });

  // The hangar: Jo, two fights, boarding, the name, the lift-off.
  await teleport(page, 30, 50);
  await teleport(page, 30, 56);
  await talkThrough(page);
  await win(page, 'hangar_1');
  await win(page, 'hangar_2');
  await expect(body).toHaveAttribute('data-objective', 'Board the surveyor', { timeout: 30_000 });
  await teleport(page, 30, 67.4);
  await talkThrough(page);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: testInfo.outputPath('4-liftoff.png') });

  // Aboard: the survivors in the hold first, then the crew, and the end of the prologue.
  await expect(body).toHaveAttribute('data-objective', 'See to the survivors in the hold', { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath('5-bridge.png') });
  await talkTo(page, 'Dena', -1.8, 11.4);
  await expect(body).toHaveAttribute('data-objective', 'Talk to your crew');
  await talkTo(page, 'Ren', -1.2, 3);
  await talkTo(page, 'Jo', -1.2, -2.5);
  // The prologue's card: what the choices came to, and the way on.
  await expect(body).toHaveAttribute('data-card', 'prologue');
  await expect(page.getByText('Last light at Ross 128')).toBeVisible();
  await expect(page.getByText(/You turned the relay by hand/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('6-end.png') });
  await page.getByRole('button', { name: 'Continue aboard Lantern' }).click();

  // Act 1 opens aboard Lantern: the crew in their places, Pyre Remnant's call, a course to set.
  await expect(body).toHaveAttribute('data-objective', 'Speak with your crew', { timeout: 20_000 });
  await talkTo(page, 'Ren', 15.5, -3);
  await talkTo(page, 'Jo', 33.2, 2.6);
  await expect(body).toHaveAttribute('data-objective', 'Hear Pell out on the bridge', { timeout: 15_000 });
  await talkTo(page, 'Pell', 2.5, 1.8);
  await expect(body).toHaveAttribute('data-objective', 'Set a course on the star map', { timeout: 15_000 });
  await teleport(page, 2.5, -2.6, Math.PI);
  await expect(body).toHaveAttribute('data-prompt', 'Open the star map');
  await page.keyboard.press('KeyE');
  // The star map: Pyre Remnant's course, and the leaving.
  await expect(body).toHaveAttribute('data-map', 'open');
  await page.screenshot({ path: testInfo.outputPath('7-map.png') });
  await page.getByRole('button', { name: 'Set course' }).click();
  await talkThrough(page);
  await expect(body).toHaveAttribute('data-checkpoint', 'lane', { timeout: 20_000 });
  // In the lanes, Pyre Remnant ahead (PYRE.md): its own journeys play it.
  await expect(body).toHaveAttribute('data-objective', 'Tell Jo when to take her in', { timeout: 20_000 });
  await page.screenshot({ path: testInfo.outputPath('8-lane.png') });
  expect(errors).toEqual([]);
});
