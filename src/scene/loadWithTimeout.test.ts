import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadWithTimeout } from './loadWithTimeout'

afterEach(() => vi.useRealTimers())

describe('optional scene download', () => {
  it('returns a successfully loaded module and clears its deadline', async () => {
    vi.useFakeTimers()
    const module = { default: 'race-scene' }
    await expect(loadWithTimeout(async () => module, 15_000)).resolves.toBe(module)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects a failed download promptly so the caller can use Classic view', async () => {
    vi.useFakeTimers()
    const error = new Error('Failed to fetch dynamically imported module')
    await expect(loadWithTimeout(() => Promise.reject(error), 15_000)).rejects.toBe(error)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects a stalled request at the deadline and ignores a late result', async () => {
    vi.useFakeTimers()
    let resolveDownload!: (module: string) => void
    const download = new Promise<string>((resolve) => {
      resolveDownload = resolve
    })
    const loaded = loadWithTimeout(() => download, 15_000)
    const deadline = expect(loaded).rejects.toThrow('Loading timed out.')
    await vi.advanceTimersByTimeAsync(14_999)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await deadline
    resolveDownload('late scene')
    await expect(loaded).rejects.toThrow('Loading timed out.')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels pending work when the presentation is switched or unmounted', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const load = vi.fn(() => new Promise(() => {}))
    const loaded = loadWithTimeout(load, 15_000, controller.signal)
    const cancelled = expect(loaded).rejects.toThrow('Loading cancelled.')
    controller.abort()
    await cancelled
    expect(load).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a download after cancellation', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    controller.abort()
    const load = vi.fn(async () => 'scene')
    await expect(loadWithTimeout(load, 15_000, controller.signal)).rejects.toThrow(
      'Loading cancelled.',
    )
    expect(load).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
