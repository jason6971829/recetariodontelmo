"use client";

// ── Cache local ──────────────────────────────────────────────────
const CACHE_KEY = "dontelmo:recipes_cache";
const USERS_CACHE_KEY = "dontelmo:users_cache";
const QUEUE_KEY = "dontelmo:offline_queue";
const MAX_QUEUE_OPS = 50;    // límite de operaciones pendientes
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — caché se considera fresco

export function cacheRecipes(recipes) {
  const payload = JSON.stringify({ data: recipes, timestamp: Date.now() });
  try {
    localStorage.setItem(CACHE_KEY, payload);
  } catch {
    // QuotaExceededError — intentar con las últimas 100 recetas
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: recipes.slice(-100), timestamp: Date.now() }));
    } catch {}
  }
}

export function getCachedRecipes() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    // Ignorar caché si tiene más de 24h (datos muy obsoletos)
    if (timestamp && Date.now() - timestamp > CACHE_TTL_MS) return null;
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
    const { data, timestamp } = JSON.parse(raw);
    if (timestamp && Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

// ── Cola de operaciones offline ──────────────────────────────────
export function addToQueue(operation) {
  try {
    const queue = getQueue();
    // Limitar cola para evitar crecimiento ilimitado
    if (queue.length >= MAX_QUEUE_OPS) queue.splice(0, queue.length - MAX_QUEUE_OPS + 1);
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
