import { test, expect, type Page } from 'playwright/test'

async function generateProgram(page: Page) {
  await page.getByRole('button', { name: 'Generate program', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Start racing', exact: true })).toBeEnabled()
}

async function startRace(page: Page) {
  await generateProgram(page)
  await page.getByRole('button', { name: 'Start racing', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause race', exact: true })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  // A mobile browser can expand innerWidth to fit overflowing content; compare
  // against the requested viewport instead of accepting that expansion.
  expect(contentWidth).toBeLessThanOrEqual(page.viewportSize()!.width)
}

test.beforeEach(async ({ page }) => {
  // Advance actual browser time instead of mutating application state.
  await page.clock.install({ time: new Date('2026-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-01-01T12:00:01Z'))
  await page.goto('/')
  await page.clock.runFor(32)
  // The clock is paused, so explicitly dismiss the opening when motion is on.
  // Reduced-motion projects bypass it immediately without a fullscreen wait.
  const skipIntro = page.getByRole('button', { name: 'Skip intro', exact: true })
  if (await skipIntro.isVisible()) await skipIntro.click()
  await expect(page.locator('.app-shell')).toHaveJSProperty('inert', false)
  // Keep core race-rule coverage independent of GPU availability. The 3D
  // presentation has its own scenario below and shares this same race state.
  await page.getByRole('button', { name: 'Classic view', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Classic view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test.describe('appearance preferences', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

  test('theme switching persists across reloads in both directions', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(
      page.getByRole('button', { name: 'Switch to light mode', exact: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('paddock-theme'))).toBe('dark')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await page.evaluate(() => localStorage.getItem('paddock-theme'))).toBe('light')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(
      page.getByRole('button', { name: 'Switch to dark mode', exact: true }),
    ).toBeVisible()
  })

  test('reduced motion bypasses the opening without advancing the clock', async ({ page }) => {
    await page.reload()
    await expect(page.getByRole('region', { name: 'Welcome to Paddock', exact: true })).toHaveCount(
      0,
    )
    await expect(page.locator('.app-shell')).toHaveJSProperty('inert', false)
    await expect(
      page.getByRole('button', { name: 'Generate program', exact: true }).first(),
    ).toBeEnabled()
    await generateProgram(page)
  })
})

test.describe('cinematic opening', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('returns on reload and Escape restores page interaction', async ({ page }) => {
    const opening = page.getByRole('region', { name: 'Welcome to Paddock', exact: true })
    await expect(opening).toHaveCount(0)

    await page.reload()
    await expect(opening).toBeVisible()
    await expect(page.locator('.app-shell')).toHaveJSProperty('inert', true)
    await expect(page.getByRole('button', { name: 'Skip intro', exact: true })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(opening).toHaveCount(0)
    await expect(page.locator('.app-shell')).toHaveJSProperty('inert', false)
    await generateProgram(page)
  })
})

test('generates six valid line-ups from a stable twenty-horse paddock', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Start racing', exact: true })).toBeDisabled()
  await expect(page.locator('.contender-grid > li')).toHaveCount(20)
  const roster = await page.locator('.contender-grid .contender-name').allTextContents()
  expect(new Set(roster).size).toBe(20)
  await expectNoHorizontalOverflow(page)

  await generateProgram(page)
  await expect(page.getByRole('tabpanel').getByRole('button')).toHaveCount(6)
  for (let round = 1; round <= 6; round++) {
    const heading = page.getByRole('button', {
      name: new RegExp(`Round ${round}\\b`),
    })
    if ((await heading.getAttribute('aria-expanded')) !== 'true') await heading.click()
    const entries = page.locator(`#round-${round} > li`)
    await expect(entries).toHaveCount(10)
    const names = await entries.locator('span:nth-child(3)').allTextContents()
    expect(new Set(names).size).toBe(10)
    expect(names.every((name) => roster.includes(name))).toBe(true)
    await expect(heading).toContainText(`${(1000 + round * 200).toLocaleString('en-GB')} metres`)
  }
  await page.getByRole('button', { name: 'New program', exact: true }).click()
  expect(await page.locator('.contender-grid .contender-name').allTextContents()).toEqual(roster)
  await expect(page.getByRole('tab', { name: 'Results 0', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('pause freezes both displayed time and runners, and resume continues the same round', async ({
  page,
}) => {
  await startRace(page)
  await page.clock.fastForward(1000)
  await expect(page.locator('.race-clock strong')).not.toHaveText('0:00.0')
  await page.getByRole('button', { name: 'Pause race', exact: true }).click()
  const time = await page.locator('.race-clock strong').textContent()
  const positions = await page
    .locator('.runner')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).style.left))

  await page.clock.fastForward(60_000)
  await expect(page.locator('.race-clock strong')).toHaveText(time!)
  expect(
    await page
      .locator('.runner')
      .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).style.left)),
  ).toEqual(positions)
  await expect(page.getByRole('button', { name: 'New program', exact: true })).toBeDisabled()
  await expect(page.getByRole('tab', { name: 'Results 0', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Resume race', exact: true }).click()
  await page.clock.fastForward(1000)
  await expect(page.locator('.race-clock strong')).not.toHaveText(time!)
  await expect(page.locator('.track-meta')).toContainText('Round 1')
  await expect(page.getByRole('button', { name: 'Pause race', exact: true })).toBeVisible()
})

test('publishes each completed round and preserves six complete ordered result lists', async ({
  page,
}) => {
  await startRace(page)
  // At 8x speed, 12 real seconds completes round one, but cannot finish round two.
  await page.clock.fastForward(12_000)
  await expect(page.getByRole('tab', { name: 'Results 1', exact: true })).toBeVisible()
  await expect(page.locator('.track-meta')).toContainText('Round 2')
  await page.getByRole('tab', { name: 'Results 1', exact: true }).click()
  await expect(page.locator('#result-1 > li')).toHaveCount(10)

  await page.clock.fastForward(120_000)
  await expect(page.getByRole('status')).toContainText('Race day complete')
  await expect(page.getByRole('button', { name: 'Race again', exact: true })).toBeEnabled()
  await expect(page.getByRole('tab', { name: 'Results 6', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('tabpanel').getByRole('button')).toHaveCount(6)

  for (let round = 1; round <= 6; round++) {
    const heading = page.getByRole('button', {
      name: new RegExp(`Round ${round}\\b`),
    })
    if ((await heading.getAttribute('aria-expanded')) !== 'true') await heading.click()
    const rows = page.locator(`#result-${round} > li`)
    await expect(rows).toHaveCount(10)
    expect(await rows.locator('.entry-number').allTextContents()).toEqual(
      Array.from({ length: 10 }, (_, index) => String(index + 1)),
    )
    const names = await rows.locator('span:nth-child(3)').allTextContents()
    expect(new Set(names).size).toBe(10)
    const times = (await rows.locator('.entry-condition').allTextContents()).map((time) =>
      Number.parseFloat(time),
    )
    expect(times.every((time) => Number.isFinite(time) && time > 0)).toBe(true)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  }
  await expectNoHorizontalOverflow(page)

  await page.getByRole('button', { name: 'Race again', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Results 0', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Program 6', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('#round-1 > li')).toHaveCount(10)
  await page.clock.fastForward(120_000)
  await expect(page.getByRole('tab', { name: 'Results 6', exact: true })).toBeVisible()
  await expect(page.getByRole('tabpanel').getByRole('button')).toHaveCount(6)
})

test('reset requires confirmation, clears results, and retains the program', async ({ page }) => {
  await generateProgram(page)
  const firstLineup = await page.locator('#round-1 > li span:nth-child(3)').allTextContents()
  await page.getByRole('button', { name: 'Start racing', exact: true }).click()
  await page.clock.fastForward(12_000)
  await expect(page.getByRole('tab', { name: 'Results 1', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset race day', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Keep race day', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume race', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Results 1', exact: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Results 1', exact: true }).click()
  await page.getByRole('button', { name: 'Reset race day', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Reset race day', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Start racing', exact: true })).toBeEnabled()
  await expect(page.locator('.race-clock strong')).toHaveText('0:00.0')
  await expect(page.getByRole('tab', { name: 'Results 0', exact: true })).toBeVisible()
  expect(await page.locator('#round-1 > li span:nth-child(3)').allTextContents()).toEqual(
    firstLineup,
  )
  await expect(page.getByRole('button', { name: 'New program', exact: true })).toBeEnabled()
})

test('keyboard tab navigation and instructions work without progressing a paused race', async ({
  page,
}) => {
  await generateProgram(page)
  const program = page.getByRole('tab', { name: 'Program 6', exact: true })
  const results = page.getByRole('tab', { name: 'Results 0', exact: true })
  await program.focus()
  await page.keyboard.press('ArrowRight')
  await expect(results).toBeFocused()
  await expect(results).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('The podium is waiting.', { exact: true })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(program).toBeFocused()
  await expect(program).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('button', { name: 'Start racing', exact: true }).click()
  await page.clock.fastForward(1000)
  await page.getByRole('button', { name: 'How it works', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const time = await page.locator('.race-clock strong').textContent()
  await page.clock.fastForward(60_000)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume race', exact: true })).toBeVisible()
  await expect(page.locator('.race-clock strong')).toHaveText(time!)
  await expectNoHorizontalOverflow(page)
})

test('filters the field, sorts by condition and name, and selects a contender without changing the draw', async ({
  page,
}) => {
  const field = page.getByRole('region', { name: 'Meet the contenders.' })
  const cards = field.locator('.contender-grid > li')
  const names = field.locator('.contender-name')
  const originalRoster = await names.allTextContents()
  await expect(cards).toHaveCount(20)
  await expect(field.getByRole('button', { name: 'This race 0', exact: true })).toBeDisabled()

  await generateProgram(page)
  const startingLineup = await page.locator('#round-1 > li span:nth-child(3)').allTextContents()
  const raceFilter = field.getByRole('button', { name: 'This race 10', exact: true })
  await raceFilter.click()
  await expect(raceFilter).toHaveAttribute('aria-pressed', 'true')
  await expect(cards).toHaveCount(10)
  expect(new Set(await names.allTextContents())).toEqual(new Set(startingLineup))

  await field.getByRole('combobox', { name: 'Sort contenders' }).selectOption('condition')
  const conditions = (await field.locator('.contender-condition > strong').allTextContents()).map(
    (value) => Number.parseInt(value, 10),
  )
  expect(conditions).toEqual([...conditions].sort((a, b) => b - a))

  await field.getByRole('combobox', { name: 'Sort contenders' }).selectOption('name')
  const sortedNames = await names.allTextContents()
  expect(sortedNames).toEqual([...sortedNames].sort((a, b) => a.localeCompare(b, 'en')))
  const selectedName = sortedNames[0]!
  const selectedCard = field.getByRole('button', {
    name: new RegExp(`^${selectedName}, condition`),
  })
  await selectedCard.click()
  await expect(selectedCard).toHaveAttribute('aria-pressed', 'true')
  await expect(field.locator('.profile-identity h3')).toHaveText(selectedName)
  await expect(field.locator('.profile-status')).toHaveText('In the current line-up')
  await expect(field.getByRole('button', { name: 'Follow on track', exact: true })).toBeVisible()
  expect(await page.locator('#round-1 > li span:nth-child(3)').allTextContents()).toEqual(
    startingLineup,
  )

  await field.getByRole('button', { name: 'All contenders 20', exact: true }).click()
  await field.getByRole('combobox', { name: 'Sort contenders' }).selectOption('number')
  await expect(cards).toHaveCount(20)
  expect(await names.allTextContents()).toEqual(originalRoster)
  await expect(selectedCard).toHaveAttribute('aria-pressed', 'true')
  await expectNoHorizontalOverflow(page)
})

test('3D camera and followed-runner controls preserve a paused race across presentation changes', async ({
  page,
}) => {
  const supportsWebGL = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    const available = !!context
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return available
  })
  test.skip(
    !supportsWebGL,
    'This browser does not expose WebGL 2; core racing is tested in Classic view.',
  )

  await startRace(page)
  await page.clock.fastForward(1000)
  await page.getByRole('button', { name: 'Pause race', exact: true }).click()
  const pausedTime = await page.locator('.race-clock strong').textContent()
  const pausedPositions = await page
    .locator('.runner')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).style.left))

  await page.getByRole('button', { name: '3D experience', exact: true }).click()
  await expect(page.locator('.race-experience .scene-loading')).toHaveCount(0, { timeout: 15_000 })
  await page.clock.runFor(32)
  await expect(page.locator('.race-scene-canvas')).toBeVisible()
  const originalCanvas = await page.locator('.race-scene-canvas').elementHandle()
  await page.getByRole('button', { name: '3D experience', exact: true }).click()
  expect(
    await page
      .locator('.race-scene-canvas')
      .evaluate((current, original) => current === original, originalCanvas),
  ).toBe(true)
  const grandstand = page.getByRole('button', { name: /Grandstand$/ })
  const trackside = page.getByRole('button', { name: /Trackside$/ })
  const finishLine = page.getByRole('button', { name: /Finish line$/ })
  await expect(grandstand).toHaveAttribute('aria-pressed', 'true')

  const followedRunner = page.locator('.order-chips > button').first()
  const followedName = (await followedRunner.textContent())!.replace(/^\s*\d+\s*/, '').trim()
  await followedRunner.click()
  await expect(followedRunner).toHaveAttribute('aria-pressed', 'true')
  await expect(trackside).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.scene-caption small')).toContainText(followedName)

  await finishLine.click()
  await expect(finishLine).toHaveAttribute('aria-pressed', 'true')
  await expect(trackside).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.scene-caption small')).toHaveText('THE FINISH LINE')
  await grandstand.click()
  await expect(grandstand).toHaveAttribute('aria-pressed', 'true')
  await page.clock.runFor(1000)
  await expect(page.locator('.race-clock strong')).toHaveText(pausedTime!)

  await page.getByRole('button', { name: 'Classic view', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume race', exact: true })).toBeVisible()
  await expect(page.locator('.race-clock strong')).toHaveText(pausedTime!)
  expect(
    await page
      .locator('.runner')
      .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).style.left)),
  ).toEqual(pausedPositions)
  await expectNoHorizontalOverflow(page)
})

test('a failed 3D module download falls back to a working Classic race', async ({ page }) => {
  await page.route('**/assets/RaceScene-*.js', (route) => route.abort('failed'))
  await page.reload()
  await expect(page.locator('.scene-fallback')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Classic view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('.scene-loading')).toHaveCount(0)
  await startRace(page)
  await page.clock.fastForward(1000)
  await expect(page.locator('.race-clock strong')).not.toHaveText('0:00.0')
})
