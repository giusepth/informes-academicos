/**
 * sessionStorage persistence helpers, extracted so the policy is testable in
 * isolation. `writeStorage` returns false instead of swallowing failures: the
 * caller can surface a quota warning to the teacher (exports live in .xlsx,
 * so nothing is lost — but the session is).
 */

export function readStorage(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    /* sessionStorage may be unavailable (private mode) or the ~5 MB origin
       quota ran out (big logo + long sessions); volatile state still works. */
    return false
  }
}
