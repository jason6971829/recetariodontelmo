"use client";
// Avisa a GabyControl que cambiaron recetas (ver app/api/recetario-sync).
// - Nunca bloquea ni falla un guardado: no se espera la respuesta y se ignora cualquier error.
// - Agrupa: varios avisos seguidos salen como uno solo, y entre dos avisos hay al menos 30 s
//   (GabyControl tarda 10-20 s en sincronizar; lo que cambie mientras tanto sale en el siguiente).
// - Si la app se cierra con un aviso pendiente, se manda al instante (keepalive).
const MIN_GAP_MS = 30_000;
const DEBOUNCE_MS = 1_500;
let timer = null;
let lastSent = 0;
let pending = [];
let hooked = false;

function send() {
  clearTimeout(timer); timer = null;
  if (!pending.length) return;
  const motivo = [...new Set(pending)].join(", ");
  pending = [];
  lastSent = Date.now();
  try {
    fetch("/api/recetario-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* nunca rompe nada */ }
}

export function avisarGabyControl(motivo = "receta") {
  if (typeof window === "undefined") return;
  if (!hooked) {
    hooked = true;
    window.addEventListener("pagehide", () => { if (pending.length) send(); });
  }
  pending.push(motivo);
  clearTimeout(timer);
  timer = setTimeout(send, Math.max(DEBOUNCE_MS, lastSent + MIN_GAP_MS - Date.now()));
}
