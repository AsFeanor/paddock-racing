/** Download and parse a model within one deadline, releasing results that arrive after cancellation. */
export function loadModelWithTimeout<T>(
  url: string,
  parse: (data: ArrayBuffer, resourcePath: string) => Promise<T>,
  dispose: (model: T) => void,
  signal: AbortSignal,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Model loading cancelled.', 'AbortError'))
      return
    }

    const download = new AbortController()
    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      action()
    }
    const rejectLoading = (error: unknown) =>
      finish(() => {
        download.abort()
        reject(error)
      })
    const cancel = () => rejectLoading(new DOMException('Model loading cancelled.', 'AbortError'))
    const timer = setTimeout(
      () => rejectLoading(new Error('Horse model loading timed out.')),
      timeoutMs,
    )
    signal.addEventListener('abort', cancel, { once: true })

    void (async () => {
      try {
        const response = await fetch(url, { signal: download.signal })
        if (download.signal.aborted) return
        if (!response.ok) throw new Error(`Horse model download failed (${response.status}).`)
        const data = await response.arrayBuffer()
        if (download.signal.aborted) return
        // GLTFLoader.parseAsync has no cancellation API. Its detached result must
        // still be disposed if parsing finishes after the deadline or unmount.
        const model = await parse(data, new URL('.', url).href)
        if (settled) dispose(model)
        else finish(() => resolve(model))
      } catch (error) {
        rejectLoading(error)
      }
    })()
  })
}
