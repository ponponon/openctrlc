// The full remote-connection entry can claim up to 320px in the titlebar and
// push session tabs into scrolling, so it collapses while tabs are starved.
// Expanding it again reclaims at most 320px - 38px (compact content floor) =
// ~282px of tab space; requiring 300px of spare first means the strip stays
// non-overflowing after the entry grows back, so the two states cannot flap
// on every resize.
export const CONNECTION_EXPAND_SPARE = 300

export function nextConnectionCompact(compact: boolean, state: { overflowing: boolean; freeSpace: number }) {
  if (state.overflowing) return true
  return compact && state.freeSpace <= CONNECTION_EXPAND_SPARE
}
