export type SessionSearchBarDomInput = {
  query: string
  scope: string
  scopes: { value: string; label: string }[]
  matches: number
  activeMatch: number
  loading: boolean
  partial: boolean
  error?: string
  labels: {
    input: string
    scope: string
    results: string
    noResults: string
    loading: string
    partial: string
    retry: string
    previous: string
    next: string
    close: string
  }
  onQueryChange: (query: string) => void
  onScopeChange: (scope: string) => void
  onNavigate: (direction: -1 | 1) => void
  onRetry: () => void
  onClose: () => void
}

export function renderSessionSearchBarDom(root: HTMLElement, input: SessionSearchBarDomInput) {
  root.replaceChildren()
  const bar = document.createElement("div")
  bar.dataset.component = "session-search-bar"
  bar.setAttribute("role", "search")

  const field = document.createElement("div")
  field.dataset.component = "session-search-bar-field"
  const query = document.createElement("input")
  query.value = input.query
  query.setAttribute("aria-label", input.labels.input)
  query.autofocus = true
  query.addEventListener("input", () => input.onQueryChange(query.value))
  field.append(query)

  const scope = document.createElement("select")
  scope.setAttribute("aria-label", input.labels.scope)
  for (const option of input.scopes) {
    const item = document.createElement("option")
    item.value = option.value
    item.textContent = option.label
    scope.append(item)
  }
  scope.value = input.scope
  scope.addEventListener("change", () => input.onScopeChange(scope.value))

  const status = document.createElement("div")
  status.setAttribute("aria-live", "polite")
  if (input.loading) status.textContent = input.labels.loading
  else if (input.matches > 0) status.textContent = input.labels.results
  else if (input.query) status.textContent = input.labels.noResults
  if (input.partial) status.append(` ${input.labels.partial}`)
  if (input.error) {
    status.append(` ${input.error}`)
    const retry = document.createElement("button")
    retry.type = "button"
    retry.textContent = input.labels.retry
    retry.addEventListener("click", input.onRetry)
    status.append(retry)
  }

  const actions = document.createElement("div")
  const previous = navigationButton(input.labels.previous, input.matches === 0, () => input.onNavigate(-1))
  const next = navigationButton(input.labels.next, input.matches === 0, () => input.onNavigate(1))
  const close = navigationButton(input.labels.close, false, input.onClose)
  actions.append(previous, next, close)

  bar.append(field, scope, status, actions)
  root.append(bar)
  return { bar, query, scope, status, previous, next, close }
}

function navigationButton(label: string, disabled: boolean, onClick: () => void) {
  const button = document.createElement("button")
  button.type = "button"
  button.disabled = disabled
  button.setAttribute("aria-label", label)
  button.addEventListener("click", onClick)
  return button
}
