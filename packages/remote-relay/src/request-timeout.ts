export class ResponseHeadersTimeoutError extends Error {
  constructor() {
    super("Desktop did not respond before the relay response-header deadline")
    this.name = "ResponseHeadersTimeoutError"
  }
}

export function withResponseHeadersTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ResponseHeadersTimeoutError()), timeoutMs)
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
