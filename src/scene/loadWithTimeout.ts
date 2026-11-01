/** Bound an optional presentation download without leaving its caller waiting forever. */
export function loadWithTimeout<T>(
  load: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Loading cancelled.'))
      return
    }

    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      action()
    }
    const cancel = () => finish(() => reject(new Error('Loading cancelled.')))
    const timer = setTimeout(() => finish(() => reject(new Error('Loading timed out.'))), timeoutMs)
    signal?.addEventListener('abort', cancel, { once: true })

    Promise.resolve()
      .then(() => {
        if (signal?.aborted) throw new Error('Loading cancelled.')
        return load()
      })
      .then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error)),
      )
  })
}
