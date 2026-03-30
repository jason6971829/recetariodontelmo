"use client";

// ── SHA-256 via Web Crypto API ────────────────────────────────────
export async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Hash por defecto de "telmo2027"
export const DEFAULT_PROFILE_HASH = "55f051f922053fbea76d1a8388734e1b6fa4f6d49fba80141c1d5dee1cd6fbd7";

// ── Brute-force login protection ─────────────────────────────────
const ATTEMPT_KEY  = "dontelmo:loginAttempts";
const LOCKOUT_KEY  = "dontelmo:loginLockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000; // 5 minutos

export function getLoginAttempts() {
  return parseInt(localStorage.getItem(ATTEMPT_KEY) || "0", 10);
}

export function getLockoutUntil() {
  return parseInt(localStorage.getItem(LOCKOUT_KEY) || "0", 10);
}

export function isLockedOut() {
  const until = getLockoutUntil();
  return Date.now() < until;
}

export function getLockoutSecondsLeft() {
  const until = getLockoutUntil();
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function registerFailedAttempt() {
  const attempts = getLoginAttempts() + 1;
  localStorage.setItem(ATTEMPT_KEY, String(attempts));
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
    localStorage.setItem(ATTEMPT_KEY, "0");
  }
  return attempts;
}

export function resetLoginAttempts() {
  localStorage.removeItem(ATTEMPT_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

// ── Auto-lock (session inactivity) ───────────────────────────────
const LAST_ACTIVITY_KEY = "dontelmo:lastActivity";
export const INACTIVITY_MS = 20 * 60 * 1000; // 20 minutos

export function touchActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function isSessionExpired() {
  const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || "0", 10);
  if (!last) return false;
  return Date.now() - last > INACTIVITY_MS;
}

// Milisegundos que faltan hasta que expire la sesión (0 si ya expiró)
export function getSessionMsLeft() {
  const last = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || "0", 10);
  if (!last) return INACTIVITY_MS;
  return Math.max(0, INACTIVITY_MS - (Date.now() - last));
}
