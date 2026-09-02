export const OPEN_CODE_SESSION_ID_PATTERN = /^ses_[a-zA-Z0-9]+$/

export function isOpenCodeSessionID(value: string) {
  return OPEN_CODE_SESSION_ID_PATTERN.test(value.trim())
}
