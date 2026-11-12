"use client";
// Tamaño de vista (A− 0,85 / A 1 / A+ 1,12). Se aplica con CSS zoom en <body> (ver app/layout.js).
export const ZOOM_OPTS = [["A−", 0.85], ["A", 1], ["A+", 1.12]];

export function getZoom() {
  if (typeof window === "undefined") return 1;
  return window.__dtZoom || 1;
}

export function setZoom(z) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("dt_zoom", String(z)); } catch { /* */ }
  window.__dtZoom = z;
  document.documentElement.style.setProperty("--dt-zoom", z);
  document.documentElement.style.setProperty("--app-height", (window.innerHeight / z) + "px");
  window.dispatchEvent(new Event("dtzoom"));
}
