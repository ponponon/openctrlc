export function SessionSkeleton() {
  return (
    <div class="flex flex-col gap-4 px-4 py-6" aria-busy="true" aria-live="polite">
      <div class="flex justify-end">
        <div class="h-14 w-2/3 animate-pulse rounded-2xl rounded-br-md bg-v2-background-bg-layer-01" />
      </div>
      <div class="h-4 w-1/3 animate-pulse rounded bg-v2-background-bg-layer-01" />
      <div class="h-28 w-full animate-pulse rounded-2xl rounded-bl-md bg-v2-background-bg-layer-01" />
      <div class="flex justify-end">
        <div class="h-10 w-1/2 animate-pulse rounded-2xl rounded-br-md bg-v2-background-bg-layer-01" />
      </div>
      <div class="h-20 w-4/5 animate-pulse rounded-2xl rounded-bl-md bg-v2-background-bg-layer-01" />
    </div>
  )
}
