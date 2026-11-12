"use client";
import { useState, useEffect } from "react";
import { getZoom } from "@/lib/viewZoom";

// Breakpoints del rediseño sobre el ANCHO EFECTIVO = innerWidth / zoom
//   celular < 640 · tablet 640–1023 · desktop ≥ 1024 · táctil (hover: none) se comporta como tablet
function read() {
  if (typeof window === "undefined") return { w: 1200, zoom: 1, mobile: false, tablet: false, desktop: true, touch: false };
  const zoom = getZoom();
  const w = window.innerWidth / zoom;
  const touch = typeof matchMedia !== "undefined" && matchMedia("(hover: none)").matches;
  return { w, zoom, mobile: w < 640, tablet: w >= 640 && w < 1024, desktop: w >= 1024, touch };
}

export function useViewport() {
  const [v, setV] = useState(read);
  useEffect(() => {
    const fn = () => setV(read());
    window.addEventListener("resize", fn);
    window.addEventListener("dtzoom", fn);
    return () => { window.removeEventListener("resize", fn); window.removeEventListener("dtzoom", fn); };
  }, []);
  return v;
}
