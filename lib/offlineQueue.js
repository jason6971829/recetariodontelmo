"use client";

// ── Cache local ──────────────────────────────────────────────────
const CACHE_KEY = "dontelmo:recipes_cache";
const USERS_CACHE_KEY = "dontelmo:users_cache";
const QUEUE_KEY = "dontelmo:offline_queue";

export function cacheRecipes(recipes) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: recipes, timestamp: Date.now() }));
  } catch {}
}

export function getCachedRecipes() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return data;
  } catch { return null; }
}

export function cacheUsers(users) {
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ data: users, timestamp: Date.now() }));
  } catch {}
}

export function getCachedUsers() {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return data;
  } catch { return null; }
}

// ── Cola de operaciones offline ──────────────────────────────────
export function addToQueue(operation) {
  try {
    const queue = getQueue();
    queue.push({ ...operation, id: Date.now() + Math.random(), createdAt: new Date().toISOString() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export function removeFromQueue(id) {
  const queue = getQueue().filter(op => op.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ── Detector de conexión ─────────────────────────────────────────
export function isOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
