import { expect, type Page, test } from '@playwright/test';

/**
 * Pyre Remnant (PYRE.md), the first lead of Act 1, through the real game on a phone and a desktop:
 * the docking, the commons and its people, Mira and the choice of who comes, the Orchard's people,
 * Tilly's stall, each way into the archive, the cost both ways, and back aboard with the doctor.
 * The fights are won through the `?debug` hook (the Banked have journeys of their own).
 */
type Lightkeeper = {
  teleport(x: number, z: number, yaw: number, beta: number, y?: number): void;
  event(name: string): void;
  downAll(): void;
  credits(amount: number): number;
  kit(): { credits: number; mods: { id: string; on: string | null }[] };
  companions?: never;
  state(): {
    waiting: string[] | null;
    area: string | null;
    fight: string | null;
    companions: { name: string }[];
  };
};

const lk = <T>(page: Page, script: string) =>
  page.evaluate((s) => {
    const game = (window as unknown as { lightkeeper: Lightkeeper }).lightkeeper;
    return new Function('lk', s)(game) as T;
  }, script);

async function start(page: Page, chapter: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`./?play&debug&quality=low&chapter=${chapter}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  return errors;
}

async function teleport(page: Page, x: number, z: number, yaw = 0) {
  await lk(page, `lk.teleport(${x}, ${z}, ${yaw}, 1.4)`);
  await page.waitForTimeout(250);
}

const waiting = (page: Page) => lk<string>(page, "return lk.state().waiting?.join('|') ?? ''");

/** Reads a conversation through, choosing with `pick` (the first choice by default). */
async function talkThrough(page: Page, phone: boolean, pick: (choices: string[]) => number = () => 0) {
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-talking', 'true');
  for (let i = 0; i < 120; i++) {
    if ((await body.getAttribute('data-talking')) !== 'true') return;
    const line = await body.getAttribute('data-line');
    if (line === 'choices') {
      const choices = page.locator('.dialogue__choice');
      const index = pick(await choices.allInnerTexts());
      if (phone) await choices.nth(index).click();
      else await page.keyboard.press(`Digit${index + 1}`);
      await page.waitForTimeout(450);
    } else {
      if (phone) await page.locator('.dialogue').click();
      else await page.keyboard.press('Space');
      await page.waitForTimeout(phone ? 420 : 60);
    }
  }
  throw new Error('the conversation did not end');
}

/** Walks up to someone (by teleport), and talks when the prompt offers it. */
async function talkTo(page: Page, phone: boolean, name: string, x: number, z: number, yaw = 0) {
  await teleport(page, x, z, yaw);
  await expect(page.locator('body')).toHaveAttribute('data-prompt', `Talk to ${name}`);
  if (phone) await page.getByRole('button', { name: `Talk to ${name}` }).dispatchEvent('pointerdown');
  else await page.keyboard.press('KeyE');
}

/** Waits for the story to wait for the fight, and wins it: every foe down, as each wave comes in. */
async function win(page: Page, fight: string) {
  await expect.poll(() => waiting(page), { timeout: 40_000 }).toBe(`cleared:${fight}`);
  await expect
    .poll(
      async () => {
        await lk(page, 'lk.downAll()');
        return waiting(page);
      },
      { timeout: 40_000, intervals: [500] },
    )
    .not.toBe(`cleared:${fight}`);
}

/** Whether a door stands open: its panel slid clear of the lamp over its doorway. */
const doorOpen = (page: Page, id: string) =>
  page.evaluate((id) => {
    const scene = (
      window as unknown as {
        lightkeeper: {
          scene: { getMeshByName(n: string): { getAbsolutePosition(): { x: number; z: number } } | null };
        };
      }
    ).lightkeeper.scene;
    const panel = scene.getMeshByName(`door-${id}`)?.getAbsolutePosition();
    const lamp = scene.getMeshByName(`door-${id}-lamp`)?.getAbsolutePosition();
    return !!panel && !!lamp && Math.hypot(panel.x - lamp.x, panel.z - lamp.z) > 1;
  }, id);

const choose = (pattern: RegExp) => (choices: string[]) =>
  Math.max(
    0,
    choices.findIndex((c) => pattern.test(c)),
  );

test('the commons: Quaye speaking, the people of the station, and Mira in her clinic', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  const errors = await start(page, 'pyre_commons');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-checkpoint', 'pyre_commons');
  // Quaye's address, heard as the hero comes in, then the way the hub begins.
  await expect(body).toHaveAttribute('data-objective', 'Ask the committee why the archive is closed', {
    timeout: 60_000,
  });
  await page.screenshot({ path: testInfo.outputPath('commons.png') });
  // Ruth, in the committee room: why the archive is shut.
  await talkTo(page, phone, 'Ruth', -11, 25, Math.PI);
  await talkThrough(page, phone, choose(/proof/));
  await expect(body).toHaveAttribute('data-objective', 'See Dr Achterberg in the clinic', { timeout: 10_000 });
  // Mira in her clinic; then who comes.
  await talkTo(page, phone, 'Mira', 25.6, 7.4, -Math.PI / 2);
  // The conversation's camera takes a moment to settle on her.
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('mira.png') });
  // Mira, and straight on to who comes: Jo. Then, a moment later, the Orchard's people: aboard Lantern.
  await talkThrough(page, phone, choose(/Jo, you're with me/));
  await expect(body).toHaveAttribute('data-checkpoint', 'pyre_clinic');
  await talkThrough(page, phone, choose(/Come aboard/));
  await expect(body).toHaveAttribute('data-checkpoint', 'pyre_way', { timeout: 10_000 });
  await expect(body).toHaveAttribute('data-objective', 'Find a way into the archive');
  const squad = await lk<string[]>(page, 'return lk.state().companions.map((c) => c.name)');
  expect(squad.sort()).toEqual(['Jo', 'Mira']);
  expect(errors).toEqual([]);
});

test('Tilly sells a mod for credits, and buys one back', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  const errors = await start(page, 'pyre_commons');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-objective', 'Ask the committee why the archive is closed', {
    timeout: 60_000,
  });
  await lk(page, 'lk.credits(600)');
  await teleport(page, 14.6, -3, Math.PI / 2);
  await expect(body).toHaveAttribute('data-prompt', 'Trade with Tilly');
  if (phone) await page.getByRole('button', { name: 'Trade with Tilly' }).dispatchEvent('pointerdown');
  else await page.keyboard.press('KeyE');
  const stall = page.getByRole('dialog', { name: "Tilly's stall" });
  await expect(stall).toBeVisible();
  await expect(page.getByTestId('credits')).toContainText('600 credits');
  await page.screenshot({ path: testInfo.outputPath('stall.png') });
  // A stabiliser for 250, asked once.
  await stall.locator('[data-buy="stabiliser"] button').click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByTestId('credits')).toContainText('350 credits');
  // And sold back for half.
  await stall.locator('[data-sell="stabiliser"] button').first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByTestId('credits')).toContainText('480 credits');
  expect(await lk<number>(page, 'return lk.kit().credits')).toBe(480);
  await stall.getByRole('button', { name: 'Back' }).click();
  await expect(stall).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('each way into the archive starts its own fight', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone', 'the ways are the same on a phone; one device is enough');
  test.setTimeout(150_000);
  for (const [way, area, fight] of [
    ['way_front', 'front_hall', 'pyre_front'],
    ['way_stacks', 'stacks', 'pyre_quiet'],
    ['way_cargo', 'landing', 'pyre_cargo'],
  ] as const) {
    const errors = await start(page, 'pyre_way');
    await expect.poll(() => waiting(page), { timeout: 20_000 }).toContain(`used:${way}`);
    await lk(page, `lk.event('used:${way}')`);
    // Walk in (by teleport) where the way leads.
    const at: Record<string, [number, number]> = {
      front_hall: [-6, 38],
      reading_room: [-8, 51],
      stacks: [-22, 52.6],
      landing: [-44, 24],
    };
    if (way === 'way_stacks') {
      await expect.poll(() => waiting(page)).toBe('enter:reading_room');
      await teleport(page, ...(at.reading_room as [number, number]));
    }
    if (way === 'way_cargo') {
      await expect.poll(() => waiting(page)).toBe('enter:freight_way');
      await teleport(page, -30, -24, -Math.PI / 2);
    }
    await expect.poll(() => waiting(page), { timeout: 20_000 }).toBe(`enter:${area}`);
    await teleport(page, ...(at[area] as [number, number]));
    await expect.poll(() => waiting(page), { timeout: 30_000 }).toBe(`cleared:${fight}`);
    await page.screenshot({ path: testInfo.outputPath(`${way}.png`) });
    expect(errors).toEqual([]);
  }
});

test('the cost: the archive held, and the name in the oldest audit', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  test.setTimeout(150_000);
  const errors = await start(page, 'pyre_stacks');
  const body = page.locator('body');
  await win(page, 'pyre_stacks_1');
  await win(page, 'pyre_stacks_2');
  await talkThrough(page, phone);
  await talkThrough(page, phone, choose(/hold the archive/));
  await expect(body).toHaveAttribute('data-checkpoint', 'pyre_archive', { timeout: 20_000 });
  await win(page, 'pyre_core_1');
  await win(page, 'pyre_core_2');
  // Esben at the core, and straight on into the reading room, where Mira reads what was saved.
  await talkThrough(page, phone);
  await expect(body).toHaveAttribute('data-checkpoint', 'pyre_after', { timeout: 20_000 });
  await expect(body).toHaveAttribute('data-objective', 'Go down to the dock', { timeout: 20_000 });
  // From the core, the way out is open.
  for (const door of ['core_door', 'stacks_door', 'archive_front']) expect(await doorOpen(page, door), door).toBe(true);
  expect(errors).toEqual([]);
});

test('the cost: the dome held, its broadcast heard', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  test.skip(phone, 'the dome is played on the desktop; the archive on both');
  test.setTimeout(150_000);
  const errors = await start(page, 'pyre_stacks');
  const body = page.locator('body');
  await win(page, 'pyre_stacks_1');
  await win(page, 'pyre_stacks_2');
  await talkThrough(page, phone);
  await talkThrough(page, phone, choose(/go for the dome/));
  await expect(body).toHaveAttribute('data-checkpoint', 'pyre_dome', { timeout: 20_000 });
  // The way out of the archive stays open behind the hero (the owner was shut in, 25 October 2026).
  await expect.poll(() => doorOpen(page, 'reading_door')).toBe(true);
  await expect.poll(() => doorOpen(page, 'archive_front')).toBe(true);
  await expect.poll(() => doorOpen(page, 'stacks_door')).toBe(true);
  await teleport(page, 10, 38, Math.PI / 2);
  await win(page, 'pyre_walk');
  await expect.poll(() => waiting(page), { timeout: 20_000 }).toBe('enter:dome');
  await teleport(page, 64, 38, Math.PI / 2);
  await win(page, 'pyre_dome');
  await talkThrough(page, phone);
  await expect(body).toHaveAttribute('data-objective', "Go back to the archive's reading room", { timeout: 40_000 });
  expect(await doorOpen(page, 'reading_door')).toBe(true);
  expect(await doorOpen(page, 'dome_door')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dome.png') });
  expect(errors).toEqual([]);
});

test('back aboard Lantern, with the doctor in the med bay', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'phone';
  const errors = await start(page, 'pyre_aboard');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-objective', 'Speak with your crew', { timeout: 30_000 });
  await talkTo(page, phone, 'Mira', 20.6, 4.8, Math.PI);
  await page.screenshot({ path: testInfo.outputPath('medbay.png') });
  await talkThrough(page, phone);
  await talkTo(page, phone, 'Ren', 15.5, -3);
  await talkThrough(page, phone);
  await talkTo(page, phone, 'Jo', 33.2, 2.6);
  await talkThrough(page, phone);
  await expect(body).toHaveAttribute('data-ended', 'true', { timeout: 20_000 });
  await expect(page.getByText('Pyre Remnant is behind you')).toBeVisible();
  expect(errors).toEqual([]);
});
