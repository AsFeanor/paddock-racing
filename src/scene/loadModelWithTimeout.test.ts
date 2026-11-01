import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadModelWithTimeout } from './loadModelWithTimeout'

const modelUrl = 'https://paddock.test/assets/horse.glb'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

describe('horse model loading lifetime', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('downloads and parses once, then detaches its deadline and owner cancellation', async () => {
    const data = new ArrayBuffer(8)
    const response = { ok: true, arrayBuffer: vi.fn(async () => data) }
    const fetchModel = vi.fn(async () => response)
    vi.stubGlobal('fetch', fetchModel)
    const model = { scene: 'horse' }
    const parse = vi.fn(async () => model)
    const dispose = vi.fn()
    const owner = new AbortController()

    await expect(loadModelWithTimeout(modelUrl, parse, dispose, owner.signal)).resolves.toBe(model)
    const request = fetchModel.mock.calls[0] as unknown as [string, RequestInit]
    expect(request[0]).toBe(modelUrl)
    expect(parse).toHaveBeenCalledExactlyOnceWith(data, 'https://paddock.test/assets/')
    expect(vi.getTimerCount()).toBe(0)
    owner.abort()
    expect(request[1].signal?.aborted).toBe(false)
    expect(dispose).not.toHaveBeenCalled()
  })

  it('rejects an HTTP failure before parsing and clears its deadline', async () => {
    const readBody = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, arrayBuffer: readBody })),
    )
    const parse = vi.fn()

    await expect(
      loadModelWithTimeout(modelUrl, parse, vi.fn(), new AbortController().signal),
    ).rejects.toThrow('Horse model download failed (404).')
    expect(readBody).not.toHaveBeenCalled()
    expect(parse).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('propagates a download rejection immediately', async () => {
    const error = new TypeError('Failed to fetch')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw error
      }),
    )
    const parse = vi.fn()

    await expect(
      loadModelWithTimeout(modelUrl, parse, vi.fn(), new AbortController().signal),
    ).rejects.toBe(error)
    expect(parse).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['response', 'body'] as const)(
    'aborts a stalled %s at the 15-second deadline without starting the parser',
    async (stage) => {
      let requestSignal!: AbortSignal
      const fetchModel = vi.fn((_url: string, options: RequestInit) => {
        requestSignal = options.signal as AbortSignal
        if (stage === 'response') return new Promise<Response>(() => {})
        return Promise.resolve({ ok: true, arrayBuffer: () => new Promise<ArrayBuffer>(() => {}) })
      })
      vi.stubGlobal('fetch', fetchModel)
      const parse = vi.fn()
      const loading = loadModelWithTimeout(modelUrl, parse, vi.fn(), new AbortController().signal)
      const rejected = expect(loading).rejects.toThrow('Horse model loading timed out.')

      await vi.advanceTimersByTimeAsync(14_999)
      expect(requestSignal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await rejected
      expect(requestSignal.aborted).toBe(true)
      expect(parse).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('bounds parsing by the same deadline and disposes a late model exactly once', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ArrayBuffer(8))),
    )
    const parsed = deferred<{ scene: string }>()
    const parse = vi.fn(() => parsed.promise)
    const dispose = vi.fn()
    const loading = loadModelWithTimeout(modelUrl, parse, dispose, new AbortController().signal)
    const rejected = expect(loading).rejects.toThrow('Horse model loading timed out.')

    await vi.advanceTimersByTimeAsync(0)
    expect(parse).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(15_000)
    await rejected
    const lateModel = { scene: 'late horse' }
    parsed.resolve(lateModel)
    await vi.advanceTimersByTimeAsync(0)
    expect(dispose).toHaveBeenCalledExactlyOnceWith(lateModel)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels during parsing on owner exit, disposes its late result and removes the timer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new ArrayBuffer(8))),
    )
    const parsed = deferred<{ scene: string }>()
    const parse = vi.fn(() => parsed.promise)
    const dispose = vi.fn()
    const owner = new AbortController()
    const loading = loadModelWithTimeout(modelUrl, parse, dispose, owner.signal)
    const rejected = expect(loading).rejects.toThrow('Model loading cancelled.')

    await vi.advanceTimersByTimeAsync(0)
    expect(parse).toHaveBeenCalledOnce()
    owner.abort()
    await rejected
    expect(vi.getTimerCount()).toBe(0)
    const lateModel = { scene: 'unmounted horse' }
    parsed.resolve(lateModel)
    await vi.advanceTimersByTimeAsync(0)
    expect(dispose).toHaveBeenCalledExactlyOnceWith(lateModel)
  })

  it('does not read or parse a response that arrives after owner cancellation', async () => {
    const response = deferred<Response>()
    let requestSignal!: AbortSignal
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        requestSignal = options.signal as AbortSignal
        return response.promise
      }),
    )
    const owner = new AbortController()
    const parse = vi.fn()
    const loading = loadModelWithTimeout(modelUrl, parse, vi.fn(), owner.signal)
    const rejected = expect(loading).rejects.toThrow('Model loading cancelled.')
    owner.abort()
    await rejected
    expect(requestSignal.aborted).toBe(true)
    const readBody = vi.fn(async () => new ArrayBuffer(8))
    response.resolve({ ok: true, arrayBuffer: readBody } as unknown as Response)
    await vi.advanceTimersByTimeAsync(0)
    expect(readBody).not.toHaveBeenCalled()
    expect(parse).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not start a request for an already disposed owner', async () => {
    const fetchModel = vi.fn()
    vi.stubGlobal('fetch', fetchModel)
    const owner = new AbortController()
    owner.abort()

    await expect(loadModelWithTimeout(modelUrl, vi.fn(), vi.fn(), owner.signal)).rejects.toThrow(
      'Model loading cancelled.',
    )
    expect(fetchModel).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
