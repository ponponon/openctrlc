export function SessionSkeleton(props: { title?: string; status?: string }) {
  return (
    <div
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-6 py-10"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div class="flex w-full max-w-2xl flex-col gap-4">
        <div class="flex justify-end">
          <div class="h-12 w-2/3 animate-pulse rounded-2xl rounded-br-md bg-v2-background-bg-layer-02" />
        </div>
        <div class="h-3.5 w-1/3 animate-pulse rounded bg-v2-background-bg-layer-02" />
        <div class="h-24 w-full animate-pulse rounded-2xl rounded-bl-md bg-v2-background-bg-layer-02" />
        <div class="flex justify-end">
          <div class="h-10 w-1/2 animate-pulse rounded-2xl rounded-br-md bg-v2-background-bg-layer-02" />
        </div>
        <div class="h-16 w-4/5 animate-pulse rounded-2xl rounded-bl-md bg-v2-background-bg-layer-02" />
      </div>
      {(props.title || props.status) && (
        <div class="flex max-w-2xl flex-col items-center gap-1 text-center">
          {props.title ? <p class="text-13-medium text-v2-text-text-base">{props.title}</p> : null}
          {props.status ? <p class="text-12-regular text-v2-text-text-muted">{props.status}</p> : null}
        </div>
      )}
    </div>
  )
}
