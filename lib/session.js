"use client";
// Sesión que sobrevive a recargas (el celular/Zebra puede cerrar la pestaña al bloquearse)
// y "dónde estaba": qué ventana estaba abierta. El cierre por inactividad (20 min) sigue igual.
const SESSION_KEY = "dontelmo:session";
const CTX_KEY = "dontelmo:ctx";

const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

export const saveSession = (u) => u && put(SESSION_KEY, { id: u.id, username: u.username, at: Date.now() });
export const loadSession = () => get(SESSION_KEY);
export const clearSession = () => { put(SESSION_KEY, null); put(CTX_KEY, null); };

// ctx: { modal: "calc" } | { modal: "recipe", id }
export const saveCtx = (c) => put(CTX_KEY, c);
export const loadCtx = () => get(CTX_KEY);

// Estado guardado de una pantalla (se borra al cerrarla a propósito; si la app se cae, queda)
const FRESH_MS = 12 * 60 * 60 * 1000;
export function loadUi(key) {
  const v = get(key);
  if (!v || !v.at || Date.now() - v.at > FRESH_MS) return null;
  return v;
}
export const saveUi = (key, v) => put(key, v ? { ...v, at: Date.now() } : null);
