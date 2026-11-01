import { test, expect } from 'playwright/test'

// Baselines are generated and compared on the same Linux/Chromium CI image.
// Classic view makes these layout checks independent of WebGL/GPU rendering.
test.use({ colorScheme: 'light', contextOptions: { reducedMotion: 'reduce' }, trace: 'off' })

test.beforeEach(async ({ page }) => {
  // The initial roster stays reproducible without changing the application store.
  await page.addInitScript((seed) => {
    let value = seed
    Math.random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0
      return value / 2 ** 32
    }
  }, 2026)

  // Use system fallbacks consistently rather than depending on font-network timing.
  await page.route(/https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort())
  // Select Classic before the optional scene module can mount, so GPU startup
  // cannot add a device-dependent fallback banner to the reference screenshots.
  let releaseScene!: () => void
  const classicSelected = new Promise<void>((resolve) => {
    releaseScene = resolve
  })
  await page.route(/\/assets\/RaceScene-[^/]+\.js(?:\?.*)?$/, async (route) => {
    await classicSelected
    await route.continue()
  })
  const spriteResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/assets/horse-gallop.png'),
  )
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Classic view', exact: true }).click()
  } finally {
    releaseScene()
  }
  await expect(page.getByRole('button', { name: 'Classic view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    page.getByRole('heading', { name: 'The field is yours.', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.scene-fallback')).toHaveCount(0)
  await expect(page.locator('.contender-grid > li')).toHaveCount(20)
  const sprite = await spriteResponse
  expect(sprite.ok()).toBe(true)
  await sprite.finished()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
})

test('light race day and paddock retain their layout', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page).toHaveScreenshot('race-day-light.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('dark race day and paddock retain their layout', async ({ page }) => {
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page).toHaveScreenshot('race-day-dark.png', {
    fullPage: true,
    animations: 'disabled',
  })
})
