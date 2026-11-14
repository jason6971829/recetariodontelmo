"use client";
import { useState, useMemo, useRef, useEffect, createElement as h } from "react";
import { generatePizzaPDF } from "@/lib/recipePDF";
import { printPizzaThermal } from "@/lib/thermalPrint";
import { useViewport } from "@/hooks/useViewport";
import { normalizeIngredient } from "@/lib/ingredients";
import { parseQty, fmtScaled, fmtGaby } from "@/lib/scaleRecipe";

// ═══ Armar pizza (rediseño Don Telmo) ═══
// Solo cambia la interfaz: recetas por porción, sabores por tamaño (sufijo (c)/(m)/(p) en el nombre),
// ingredientes × porciones, impresión térmica 80 mm y PDF siguen igual que antes.

/* ─── Tamaños (sufijo del nombre de la receta) ─── */
const SIZES = {
  c: { label: "Completa", cm: 50, portions: 8 },
  m: { label: "Mediana",  cm: 40, portions: 8 },
  p: { label: "Personal", cm: 27, portions: 4 },
};
const SIZE_ORDER = ["c", "m", "p"];

/* ─── Divisiones ─── */
const ALL_CFGS = [
  { id: 0, label: "8 porciones", sub: "1 sabor",   p: [8] },
  { id: 1, label: "5 + 3",       sub: "2 sabores", p: [5, 3] },
  { id: 2, label: "2+2+2+2",     sub: "4 sabores", p: [2, 2, 2, 2] },
  { id: 3, label: "3+3+2",       sub: "3 sabores", p: [3, 3, 2] },
  { id: 4, label: "6 + 2",       sub: "2 sabores", p: [6, 2] },
  { id: 5, label: "4+2+2",       sub: "3 sabores", p: [4, 2, 2] },
  { id: 6, label: "4 + 4",       sub: "2 sabores", p: [4, 4] },
  { id: 7, label: "4 porciones", sub: "1 sabor",   p: [4] },
  { id: 8, label: "2 + 2",       sub: "2 sabores", p: [2, 2] },
];
const SIZE_CFGS = { c: [0, 1, 2, 3, 4, 5, 6], m: [0, 6, 5, 3], p: [7, 8] };

/* ─── Colores de sección ─── */
const COLORS = [["#D4721A", "#FFF0E3"], ["#1A6B9E", "#E3F2FD"], ["#27ae60", "#E8F8EE"], ["#8e44ad", "#F5E9FF"]];

/* ─── Premium ─── */
const norm = (s = "") => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const PREMIUM = new Set(["MIEL MOSTAZA", "MEXICANA PREMIUM", "HAW PREMIUM", "HAWAINA PREMIUM", "HAWAIANA PREMIUM", "AHUMADA", "COLOMBIANA", "CRIOLLA", "TRES CARNES", "PEPERONI", "PEPPERONI", "CESAR"]);

/* ─── Helpers ─── */
export function getPizzaSuffix(name = "") {
  const m = name.match(/\(([cmp])\)\s*$/i);
  return m ? m[1].toLowerCase() : null;
}
// Multiplica SOLO la cantidad del inicio ("0,018 KILO - Pepperoni | 290" × 3 → "0.054 KILO - Pepperoni"),
// con precisión de gramos, y conserva el código del insumo aparte (antes se multiplicaba también el código
// y se redondeaba a 1 decimal: 0,054 kg salía como 0,1 kg).
function scaleIngredient(ing, factor) {
  const { code, text } = normalizeIngredient(ing);
  // "21 GRAMOS - Carne" × 8 → "0,168 KILO - Carne" (formato gabycontrol, nunca gramos)
  const p = parseQty(text);
  let scaled = text;
  if (p && p.unitRaw) {
    const toBase = p.unit === "GR" ? ["KILO", 0.001] : p.unit === "ML" ? ["LITRO", 0.001] : [p.unitRaw, 1];
    scaled = `${fmtGaby(p.qty * factor * toBase[1])} ${toBase[0]}${p.name ? " - " + p.name : ""}`;
  } else if (p) {
    scaled = text.replace(/^\s*(\d+(?:[.,]\d+)*)/, () => fmtGaby(p.qty * factor));
  }
  return code ? { code, text: scaled } : scaled;
}
function cleanName(name = "") { return name.replace(/\s*\([cmp]\)\s*$/i, "").trim(); }
const tc = (s) => { const n = cleanName(s); return norm(n) === "BBQ" ? "BBQ" : n.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/ Con /g, " con "); };

/* ─── Ilustración de toppings por sabor (prototipo de diseño) ─── */
const TOP = {
  "MIEL MOSTAZA": [["pol", 10], ["toc", 5], ["~", "#E3A325"]], "MEXICANA PREMIUM": [["car", 9], ["jal", 5], ["gua", 4], ["nac", 4]],
  "HAWAIANA PREMIUM": [["jam", 8], ["pin", 8], ["cer", 4]], "HAW PREMIUM": [["jam", 8], ["pin", 8], ["cer", 4]], "HAWAINA PREMIUM": [["jam", 8], ["pin", 8], ["cer", 4]],
  "AHUMADA": [["jam", 7], ["toc", 6], ["qah", 6]], "COLOMBIANA": [["cho", 7], ["mai", 12], ["ceb", 5]], "CRIOLLA": [["pol", 9], ["mai", 10], ["hog", 8]],
  "TRES CARNES": [["jam", 5], ["pep", 5], ["cho", 4], ["toc", 4]], "PEPPERONI": [["pep", 12], ["par", 10]], "PEPERONI": [["pep", 12], ["par", 10]],
  "CESAR": [["pol", 8], ["lec", 5], ["par", 12], ["~", "#F3EBD6"]], "BBQ": [["jam", 5], ["pol", 7], ["ceb", 5], ["~", "#4E2412"]],
  "CARNES": [["jam", 6], ["cho", 5], ["car", 7]], "HAWAIANA": [["jam", 8], ["pin", 9]], "MEXICANA": [["car", 9], ["jal", 5], ["mai", 10]],
  "NAPOLITANA": [["tom", 7], ["alb", 6], ["par", 10]], "POLLO CON CHAMPINONES": [["pol", 9], ["cha", 7]], "VEGETARIANA": [["cha", 6], ["pim", 8], ["ceb", 5], ["mai", 8]],
  "FRESAS CON CHOCOLATE": [["fre", 9], ["~", "#4A2618"]], "TEXANA": [["car", 8], ["toc", 5], ["ceb", 4], ["~", "#4E2412"]], "VELENA": [["boc", 10], ["qah", 6]],
};
const DEFAULT_TOP = [["qah", 8], ["par", 10], ["alb", 3]];
const topFor = (name) => TOP[norm(cleanName(name))] || DEFAULT_TOP;
const isSweet = (name) => norm(cleanName(name)).includes("CHOCOLATE");

const SPOTS = Array.from({ length: 26 }, (_, k) => { const a = k * 2.39996, r = 10 + ((k * 53) % 62); return [100 + r * Math.cos(a), 100 + r * Math.sin(a), 5 + (k * 7 % 6)]; });
const SPECK = Array.from({ length: 22 }, (_, k) => { const a = k * 1.7 + 0.4, r = 8 + ((k * 41) % 68); return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; });
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function glyph(t, k) {
  switch (t) {
    case "pep": return [h("circle", { key: 1, r: 6.5, fill: "#B3261E", stroke: "#7E1A14", strokeWidth: 1 }), h("circle", { key: 2, cx: -2, cy: -1.5, r: 1.1, fill: "#7E1A14" }), h("circle", { key: 3, cx: 2.2, cy: 2, r: 0.9, fill: "#7E1A14" })];
    case "jam": return [h("rect", { key: 1, x: -5, y: -4, width: 10, height: 8, rx: 2, fill: "#F4A7AE", stroke: "#E07F8A", strokeWidth: 0.8 })];
    case "toc": return [h("path", { key: 1, d: "M-8 -2q4 -3 8 0t8 0v4q-4 3 -8 0t-8 0z", fill: "#A9452F" }), h("path", { key: 2, d: "M-7 0q3.5 -2.5 7 0t7 0", fill: "none", stroke: "#F0B9A0", strokeWidth: 1 })];
    case "pol": return [h("ellipse", { key: 1, rx: 6, ry: 2.3, fill: "#EBCB9C", stroke: "#C9A06A", strokeWidth: 0.6 })];
    case "pin": return [h("path", { key: 1, d: "M-4 -4L4 -4L5.5 4L-5.5 4Z", fill: "#F7CF4A", stroke: "#D9A928", strokeWidth: 0.7 })];
    case "cer": return [h("circle", { key: 1, r: 3.6, fill: "#C81D3A" }), h("circle", { key: 2, cx: -1.1, cy: -1.1, r: 1, fill: "#FFFFFF", opacity: 0.6 })];
    case "mai": return [h("ellipse", { key: 1, rx: 2.6, ry: 2, fill: "#F6C21C", stroke: "#D9A100", strokeWidth: 0.5 })];
    case "ceb": return [h("path", { key: 1, d: "M-6 1A6 6 0 0 1 6 1", fill: "none", stroke: "#D2ACE3", strokeWidth: 1.8, strokeLinecap: "round" })];
    case "jal": return [h("circle", { key: 1, r: 4.6, fill: "#3E9B3A" }), h("circle", { key: 2, r: 2.7, fill: "#CFE8A9" }), h("circle", { key: 3, cx: -0.8, cy: -0.5, r: 0.6, fill: "#F4F1D0" }), h("circle", { key: 4, cx: 0.9, cy: 0.6, r: 0.6, fill: "#F4F1D0" })];
    case "cha": return [h("path", { key: 1, d: "M-6 0A6 6 0 0 1 6 0L2 0L2 5L-2 5L-2 0Z", fill: "#DCC6A5", stroke: "#A88B66", strokeWidth: 0.7 })];
    case "tom": return [h("circle", { key: 1, r: 6, fill: "#E0442E" }), h("circle", { key: 2, r: 4, fill: "#F07A5A" }), h("circle", { key: 3, cx: -1.5, r: 0.7, fill: "#FBE3A0" }), h("circle", { key: 4, cx: 1.5, r: 0.7, fill: "#FBE3A0" })];
    case "alb": return [h("path", { key: 1, d: "M0 -6C5 -3 5 3 0 6C-5 3 -5 -3 0 -6Z", fill: "#3B8E3B" }), h("path", { key: 2, d: "M0 -5V5", stroke: "#2C6B2C", strokeWidth: 0.7 })];
    case "lec": return [h("path", { key: 1, d: "M0 -7C7 -4 6 4 0 7C-6 4 -7 -4 0 -7Z", fill: "#8CC152" }), h("path", { key: 2, d: "M0 -6V6", stroke: "#6BA03A", strokeWidth: 0.7 })];
    case "car": return [h("path", { key: 1, d: "M-6 -1q3 -3 6 -1t6 1", fill: "none", stroke: "#6E3B23", strokeWidth: 2.4, strokeLinecap: "round" })];
    case "cho": return [h("circle", { key: 1, r: 5, fill: "#922D20" }), h("circle", { key: 2, cx: -1.5, cy: -1, r: 0.9, fill: "#E8A38C" }), h("circle", { key: 3, cx: 1.6, cy: 1.4, r: 0.8, fill: "#E8A38C" })];
    case "qah": return [h("circle", { key: 1, r: 4.5, fill: "#E9B451", opacity: 0.95 })];
    case "gua": return [h("circle", { key: 1, r: 5, fill: "#86B847" }), h("circle", { key: 2, cx: -1, cy: -1, r: 2.4, fill: "#A6CF6A" })];
    case "nac": return [h("path", { key: 1, d: "M0 -6L5.5 4.5L-5.5 4.5Z", fill: "#F1B84B", stroke: "#D69A2C", strokeWidth: 0.7 })];
    case "par": return [h("rect", { key: 1, x: -1.2, y: -0.7, width: 2.4, height: 1.4, rx: 0.5, fill: "#FFF9EA" })];
    case "pim": return [h("rect", { key: 1, x: -5, y: -1.2, width: 10, height: 2.4, rx: 1.2, fill: k % 2 ? "#3E9B3A" : "#D9342B" })];
    case "fre": return [h("path", { key: 1, d: "M0 5C-6 0 -5 -5 0 -4C5 -5 6 0 0 5Z", fill: "#D7263D" }), h("path", { key: 2, d: "M-2 -4.5L0 -6.5L2 -4.5", fill: "none", stroke: "#3E9B3A", strokeWidth: 1.2 }), h("circle", { key: 3, cx: -1.5, cy: 0, r: 0.4, fill: "#FBE3A0" }), h("circle", { key: 4, cx: 1.5, cy: 1, r: 0.4, fill: "#FBE3A0" })];
    case "boc": return [h("rect", { key: 1, x: -3.5, y: -3.5, width: 7, height: 7, rx: 1, fill: "#9C2A3A" })];
    case "hog": return [h("circle", { key: 1, r: 2.2, fill: "#D9532B" })];
    default: return [];
  }
}

// Pizza en SVG: o = { uid, px, parts, fills, flavors (nombres), labels, hover, next, interactive, nums, tints, anim, slices }
function pizzaEl(o) {
  const C = 100, R = 84, u = o.uid, parts = o.parts || [1], total = parts.reduce((a, b) => a + b, 0);
  const pt = (a, r) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  let acc = 0;
  const secs = parts.map((p, i) => { const a0 = -Math.PI / 2 + acc / total * 2 * Math.PI; acc += p; return { i, p, a0, a1: -Math.PI / 2 + acc / total * 2 * Math.PI }; });
  const d = (s, r) => { const [x0, y0] = pt(s.a0, r), [x1, y1] = pt(s.a1, r); return `M${C} ${C}L${x0} ${y0}A${r} ${r} 0 ${s.a1 - s.a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`; };
  const kids = [
    h("defs", { key: "df" },
      h("radialGradient", { id: "c" + u, key: "c" }, h("stop", { offset: "0", stopColor: "#F7DCA8" }), h("stop", { offset: ".8", stopColor: "#E8B26C" }), h("stop", { offset: "1", stopColor: "#C4843F" })),
      h("radialGradient", { id: "s" + u, key: "s" }, h("stop", { offset: "0", stopColor: "#E3583B" }), h("stop", { offset: ".75", stopColor: "#C43C25" }), h("stop", { offset: "1", stopColor: "#A2301B" }))),
    h("circle", { key: "cr", cx: C, cy: C, r: 98, fill: `url(#c${u})` }),
    h("circle", { key: "cr2", cx: C, cy: C, r: 90, fill: "none", stroke: "#D9A05A", strokeWidth: 3, opacity: 0.45 }),
    h("circle", { key: "sa", cx: C, cy: C, r: R, fill: `url(#s${u})` }),
    ...SPOTS.map((s, k) => h("circle", { key: "sp" + k, cx: s[0], cy: s[1], r: s[2], fill: "#F7D88C", opacity: 0.7 })),
    ...SPECK.map((s, k) => h("circle", { key: "sk" + k, cx: s[0], cy: s[1], r: 1.1, fill: "#3F5A2B", opacity: 0.55 })),
  ];
  secs.forEach(s => {
    const fill = o.fills && o.fills[s.i], col = COLORS[s.i % 4][0], isHover = o.hover === s.i;
    const fname = o.flavors && o.flavors[s.i], full = parts.length === 1;
    if (fill && fname) {
      const cp = `cp${u}${s.i}`, shape = full ? { cx: C, cy: C, r: R } : { d: d(s, R) };
      kids.push(h("clipPath", { key: "cp" + s.i, id: cp }, full ? h("circle", shape) : h("path", shape)));
      const span = s.a1 - s.a0, scale = Math.max(0.55, Math.min(1.6, span / (Math.PI * 0.75))), rand = rng(997 + s.i * 131 + fname.length * 17), items = [];
      let n = 0;
      if (isSweet(fname)) items.push(full ? h("circle", { key: "sw", ...shape, fill: "#F3E2C0", opacity: 0.92 }) : h("path", { key: "sw", ...shape, fill: "#F3E2C0", opacity: 0.92 }));
      topFor(fname).forEach(([t, c], ti) => {
        if (t === "~") {
          const pts = [];
          for (let j = 0; j < 7; j++) { const an = s.a0 + (0.1 + 0.8 * j / 6) * span, rr = 22 + (j % 2 ? 40 : 12) + rand() * 16; pts.push(pt(an, rr)); }
          items.push(h("path", { key: "dz" + ti, d: "M" + pts[0].join(" ") + pts.slice(1).map((p, j) => { const q = pts[j]; return ` Q${((q[0] + p[0]) / 2 + 6).toFixed(1)} ${((q[1] + p[1]) / 2 - 6).toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; }).join(""), fill: "none", stroke: c, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", pathLength: 100, strokeDasharray: 100, style: { animation: `pzCut .9s ${0.35 + n * 0.02}s ease-out both` } }));
          return;
        }
        const cnt = Math.max(2, Math.round(c * scale));
        for (let j = 0; j < cnt; j++) {
          const an = s.a0 + (0.06 + 0.88 * rand()) * span, rr = 12 + Math.sqrt(rand()) * (R - 20), [x, y] = pt(an, rr), rot = Math.round(rand() * 360);
          items.push(h("g", { key: t + j, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot}) scale(1.22)` },
            h("g", { style: { transformBox: "fill-box", transformOrigin: "center", animation: `pzDrop .5s ${(n * 0.022).toFixed(3)}s cubic-bezier(.2,.8,.2,1) both` } }, glyph(t, j))));
          n++;
        }
      });
      kids.push(h("g", { key: "tp" + s.i + fname, clipPath: `url(#${cp})`, style: { pointerEvents: "none" } }, items));
    }
    const op = fill ? 0.12 : isHover ? 0.5 : o.tints ? 0.38 : 0, color = fill || isHover || o.tints ? col : "#000";
    const props = { key: "f" + s.i, fill: color, fillOpacity: op, "data-sec": o.interactive ? String(s.i) : undefined, style: { transition: "fill-opacity .35s, transform .3s cubic-bezier(.2,.8,.2,1)", transformOrigin: "100px 100px", transform: isHover ? "scale(1.045)" : "none", cursor: o.interactive ? "pointer" : "default" } };
    kids.push(parts.length === 1 ? h("circle", { ...props, cx: C, cy: C, r: R }) : h("path", { ...props, d: d(s, R) }));
    if (fill) kids.push(parts.length === 1 ? h("circle", { key: "ol" + s.i, cx: C, cy: C, r: R - 1.5, fill: "none", stroke: col, strokeWidth: 3.2, style: { pointerEvents: "none" } }) : h("path", { key: "ol" + s.i, d: d(s, R - 1.5), fill: "none", stroke: col, strokeWidth: 3.2, strokeLinejoin: "round", style: { pointerEvents: "none" } }));
    if (o.next === s.i && !fill && !isHover) kids.push(parts.length === 1 ? h("circle", { key: "n" + s.i, cx: C, cy: C, r: R - 3, fill: "none", stroke: "#FFFFFF", strokeWidth: 2.5, strokeDasharray: "7 4", style: { animation: "pzDash 1s linear infinite", pointerEvents: "none" } }) : h("path", { key: "n" + s.i, d: d(s, R - 3), fill: "none", stroke: "#FFFFFF", strokeWidth: 2.5, strokeDasharray: "7 4", strokeLinejoin: "round", style: { animation: "pzDash 1s linear infinite", pointerEvents: "none" } }));
  });
  if (o.slices !== false) for (let k = 0; k < total; k++) { const a = -Math.PI / 2 + k / total * 2 * Math.PI, [x, y] = pt(a, 96); kids.push(h("line", { key: "l" + k, x1: C, y1: C, x2: x, y2: y, stroke: "#FFF4E0", strokeWidth: 1, opacity: 0.4, style: { pointerEvents: "none" } })); }
  if (parts.length > 1) secs.forEach((s, k) => { const [x, y] = pt(s.a0, 98); kids.push(h("line", { key: "b" + k, x1: C, y1: C, x2: x, y2: y, stroke: "#FFF8EE", strokeWidth: o.px < 110 ? 3.2 : 3, strokeLinecap: "round", pathLength: 100, strokeDasharray: o.anim ? 100 : undefined, style: { pointerEvents: "none", animation: o.anim ? `pzCut .55s ${0.15 + k * 0.09}s cubic-bezier(.2,.8,.2,1) both` : undefined } })); });
  if (o.labels) secs.forEach(s => {
    const fill = o.fills && o.fills[s.i], mid = (s.a0 + s.a1) / 2, span = s.a1 - s.a0, r = parts.length === 1 ? 0 : span >= Math.PI ? 42 : span < 1 ? 60 : 54, [x, y] = pt(mid, r);
    if (fill) {
      const name = o.labels[s.i] || "", w = name.split(" ");
      let lines = [name];
      if (name.length > 9 && w.length > 1) { const m = Math.ceil(w.length / 2); lines = [w.slice(0, m).join(" "), w.slice(m).join(" ")]; }
      const fs = parts.length >= 4 ? 8.5 : 9.5, bw = Math.max(...lines.map(l => l.length)) * fs * 0.66 + 12, bh = lines.length * fs * 1.15 + 7, col = COLORS[s.i % 4][0];
      kids.push(h("g", { key: "t" + s.i + name, style: { transformBox: "fill-box", transformOrigin: "center", animation: "pzPop .45s .3s cubic-bezier(.2,.8,.2,1) both", pointerEvents: "none" } },
        h("rect", { x: x - bw / 2, y: y - bh / 2, width: bw, height: bh, rx: Math.min(bh / 2, 8), fill: col, stroke: "#FFFFFF", strokeWidth: 1.6, style: { filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))" } }),
        h("text", { x, y: y - (lines.length - 1) * fs * 0.575, textAnchor: "middle", dominantBaseline: "central", fill: "#FFFFFF", fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: fs, letterSpacing: ".03em" }, lines.map((l, j) => h("tspan", { key: j, x, dy: j ? fs * 1.15 : 0 }, l.toUpperCase())))));
    } else if (o.nums) {
      kids.push(h("g", { key: "num" + s.i, style: { pointerEvents: "none" } }, h("circle", { cx: x, cy: y, r: 11, fill: "rgba(255,255,255,.94)" }), h("text", { x, y: y + 0.5, textAnchor: "middle", dominantBaseline: "middle", fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 11, fill: COLORS[s.i % 4][0] }, s.i + 1)));
    }
  });
  return h("svg", { viewBox: "0 0 200 200", width: o.px, height: o.px, style: { display: "block", overflow: "visible", filter: `drop-shadow(0 ${o.px > 150 ? 10 : 5}px ${o.px > 150 ? 16 : 8}px rgba(70,25,0,.25))` } }, kids);
}

const PZ_CSS = `
@keyframes pzInR{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:none}}
@keyframes pzInL{from{opacity:0;transform:translateX(-36px)}to{opacity:1;transform:none}}
@keyframes pzCut{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes pzDrop{0%{opacity:0;transform:translateY(-18px) scale(1.6) rotate(-25deg)}60%{opacity:1;transform:translateY(1px) scale(.92)}100%{opacity:1;transform:none}}
@keyframes pzDash{to{stroke-dashoffset:-22}}
@keyframes pzPop{0%{opacity:0;transform:scale(.6)}70%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
@keyframes pzBreath{0%,100%{box-shadow:0 0 0 0 rgba(217,115,26,0)}50%{box-shadow:0 0 0 6px rgba(217,115,26,.18)}}
@keyframes pzDone{0%{transform:scale(1)}40%{transform:scale(1.06) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
@keyframes pzToast{0%{opacity:0;transform:translate(-50%,16px)}12%,85%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,8px)}}
@media (hover:hover){.pz-card:hover{border-color:#0E2240 !important;transform:translateY(-2px)}.pz-chip:hover{border-color:var(--pz-hover) !important}.pz-out:hover{border-color:#0E2240 !important}}
`;

const Ico = {
  slice: (s = 22, w = 1.8) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22L2.5 8.2A13 13 0 0 1 21.5 8.2z" /><path d="M5.2 9.6a10 10 0 0 1 13.6 0" /><circle cx="10" cy="12" r="1" /><circle cx="14" cy="15" r="1" /><circle cx="12" cy="18" r=".6" /></svg>,
  check: (s = 13, w = 3.2) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>,
  close: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  grip: (fill = "#C9C2B6") => <svg width="14" height="14" viewBox="0 0 24 24" fill={fill} style={{ flex: "none" }}><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>,
};

export function PizzaBuilderModal({ pizzaRecipes = [], onClose }) {
  const vp = useViewport();
  const mobile = vp.mobile, tabsMode = vp.w < 1024;
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [size, setSize] = useState(null);       // "c" | "m" | "p"
  const [div, setDiv] = useState(null);         // índice dentro de SIZE_CFGS[size]
  const [assigned, setAssigned] = useState([]); // id de receta por sección
  const [tab, setTab] = useState("sab");
  const [drag, setDrag] = useState(null);       // { id, x, y, over, touch }
  const [ticket, setTicket] = useState(false);
  const [toast, setToast] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pd = useRef(null), lp = useRef(null), lastDrag = useRef(0), toastT = useRef(null), handlers = useRef({});

  const sizeObj = size ? SIZES[size] : null;
  const cfgs = size ? SIZE_CFGS[size].map(id => ALL_CFGS.find(c => c.id === id)) : [];
  const cfg = div != null ? cfgs[div] : null;
  const parts = cfg ? cfg.p : [];
  const nSec = parts.length;
  const flavors = useMemo(() => pizzaRecipes.filter(r => getPizzaSuffix(r.name) === size), [pizzaRecipes, size]);
  const byId = useMemo(() => Object.fromEntries(flavors.map(r => [r.id, r])), [flavors]);
  const filled = assigned.filter(Boolean).length;
  const complete = nSec > 0 && filled === nSec;
  const next = assigned.indexOf(null);

  // Ingredientes en vivo (× porciones de cada sección) — mismo formato que usan la impresión y el PDF
  const liveResults = useMemo(() => parts.map((portions, i) => {
    const r = byId[assigned[i]];
    if (!r) return null;
    return { sec: i, name: cleanName(r.name), portions, color: COLORS[i % 4][0], light: COLORS[i % 4][1], ingredients: (r.ingredients || []).map(ing => scaleIngredient(ing, portions)) };
  }).filter(Boolean), [parts, assigned, byId]);

  const showToast = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2400); };
  const update = (a) => {
    setAssigned(a);
    if (a.length && a.every(Boolean) && tabsMode) setTimeout(() => setTab("ing"), 550);
  };
  const tap = (id) => {
    const a = [...assigned], i = a.indexOf(id);
    if (i >= 0) { a[i] = null; update(a); return; }
    const n = a.indexOf(null);
    if (n < 0) { showToast("Todas las secciones tienen sabor · toca uno para quitarlo"); return; }
    a[n] = id; update(a);
  };
  const drop = (id, sec) => { const a = assigned.map(x => (x === id ? null : x)); a[sec] = id; update(a); };
  const go = (s) => { setDir(s > step ? 1 : -1); setStep(s); setDrag(null); };

  // ── Arrastre: mouse (>6 px) o dedo (mantener 200 ms) ──
  const secAt = (x, y) => { const el = document.elementFromPoint(x, y); const t = el && el.closest && el.closest("[data-sec]"); return t ? +t.getAttribute("data-sec") : null; };
  const cleanup = () => {
    clearTimeout(lp.current);
    const hd = handlers.current;
    window.removeEventListener("pointermove", hd.pm); window.removeEventListener("pointerup", hd.pu); window.removeEventListener("pointercancel", hd.pc);
    pd.current = null;
  };
  useEffect(() => {
    const tm = (e) => { if (pd.current && pd.current.started) e.preventDefault(); };
    window.addEventListener("touchmove", tm, { passive: false });
    return () => { window.removeEventListener("touchmove", tm); cleanup(); clearTimeout(toastT.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // los manejadores del arrastre leen las funciones actuales vía ref
  const live = useRef({});
  live.current = { tap, drop };
  const down = (id, e) => {
    if (e.button > 0) return;
    const touch = e.pointerType === "touch";
    cleanup();
    const p = pd.current = { id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, touch, started: false };
    const begin = (x, y) => { p.started = true; setDrag({ id, x, y, over: secAt(x, y), touch }); };
    if (touch) lp.current = setTimeout(() => { try { navigator.vibrate?.(12); } catch { /* */ } begin(p.x, p.y); }, 200);
    const pm = (ev) => {
      const dist = Math.hypot(ev.clientX - p.sx, ev.clientY - p.sy);
      if (!p.started) {
        if (touch) { if (dist > 8) cleanup(); else { p.x = ev.clientX; p.y = ev.clientY; } return; }
        if (dist > 6) begin(ev.clientX, ev.clientY); else return;
      }
      setDrag({ id, x: ev.clientX, y: ev.clientY, over: secAt(ev.clientX, ev.clientY), touch });
    };
    const pu = (ev) => {
      const st = p.started; cleanup();
      if (st) { lastDrag.current = Date.now(); const over = secAt(ev.clientX, ev.clientY); setDrag(null); if (over != null) live.current.drop(id, over); }
      else live.current.tap(id);
    };
    const pc = () => { cleanup(); setDrag(null); };
    handlers.current = { pm, pu, pc };
    window.addEventListener("pointermove", pm); window.addEventListener("pointerup", pu); window.addEventListener("pointercancel", pc);
  };

  const close = () => { cleanup(); onClose?.(); };
  const canNext = step === 1 ? !!size : step === 2 ? div != null : complete;
  const primary = () => { if (!canNext) return; if (step < 3) go(step + 1); else { showToast("Pizza lista"); setTimeout(close, 900); } };
  const doPDF = async () => {
    setPdfLoading(true);
    try { await generatePizzaPDF({ size: sizeObj, cfg, liveResults }); showToast("PDF descargado"); }
    catch { showToast("No se pudo generar el PDF"); }
    finally { setPdfLoading(false); }
  };

  // ── medidas ──
  const pad = mobile ? 14 : 22;
  const pzPx = mobile ? 148 : tabsMode ? 220 : 268;
  const stepAnim = `${dir > 0 ? "pzInR" : "pzInL"} .45s cubic-bezier(.2,.8,.2,1) both`;
  const maxW = step === 1 ? 760 : step === 2 ? 780 : 1240;
  const fullH = "var(--app-height, 100vh)";

  // ingrediente → { code, qty, conv, name }
  const ingRow = (ing) => {
    const n = normalizeIngredient(ing);
    const p = parseQty(n.text);
    if (!p) return { code: n.code, qty: "", conv: "", name: n.text };
    const sc = fmtScaled(p, 1);
    return { code: n.code, qty: sc.main, conv: sc.sub ? ` · ${sc.sub}` : "", name: p.name };
  };

  const chip = (r) => {
    const i = assigned.indexOf(r.id), on = i >= 0, dragged = drag && drag.id === r.id;
    const col = on ? COLORS[i % 4] : null;
    return (
      <div key={r.id} role="button" tabIndex={0} className="pz-chip"
        onPointerDown={(e) => down(r.id, e)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(r.id); } }}
        style={{ "--pz-hover": on ? col[0] : "#0E2240", display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 8px 0 12px", borderRadius: 12, border: `1.5px solid ${on ? col[0] : "#E7E1D7"}`, background: on ? col[1] : "#fff", color: on ? col[0] : "#14213D", cursor: "grab", userSelect: "none", WebkitUserSelect: "none", touchAction: "pan-y", opacity: dragged ? 0.35 : 1, transform: `scale(${dragged ? 0.96 : 1})`, transition: "background .25s,border-color .25s,color .25s,opacity .2s,transform .2s" }}>
        {on && <span style={{ flex: "none", display: "flex", animation: "pzPop .3s both" }}>{Ico.check(14, 3)}</span>}
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tc(r.name)}</span>
        {on ? <span style={{ flex: "none", height: 22, padding: "0 8px", borderRadius: 7, background: col[0], color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", animation: "pzPop .3s both" }}>Sec {i + 1}</span> : Ico.grip()}
      </div>
    );
  };

  const groups = [
    ["PREMIUM", "#B07A00", "#F2C14E", flavors.filter(r => PREMIUM.has(norm(cleanName(r.name))))],
    ["TRADICIONAL", "#C8423B", "none", flavors.filter(r => !PREMIUM.has(norm(cleanName(r.name))))],
  ].filter(g => g[3].length);

  const ingCards = liveResults.map(r => ({ ...r, rows: r.ingredients.map(ingRow) }));
  const flavorNames = assigned.map(id => (byId[id] ? byId[id].name : null));

  return (
    <div className="dt-scope" onClick={(e) => { if (e.target === e.currentTarget && Date.now() - lastDrag.current > 400) close(); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(9,24,49,.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 24, animation: "dtFade .25s both", fontFamily: "var(--dt-sans)", color: "#14213D" }}>
      <style>{PZ_CSS}</style>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: mobile ? "100%" : maxW, height: mobile ? fullH : (step === 3 ? `min(calc(${fullH} * .92), 900px)` : "auto"), maxHeight: mobile ? fullH : `min(calc(${fullH} * .92), 900px)`, background: "#F6F3EE", borderRadius: mobile ? 0 : 24, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 80px -20px rgba(0,0,0,.5)", transition: "max-width .45s cubic-bezier(.2,.8,.2,1), height .45s cubic-bezier(.2,.8,.2,1)", animation: mobile ? "dtSheet .42s cubic-bezier(.2,.8,.2,1) both" : "dtPop .38s cubic-bezier(.2,.8,.2,1) both" }}>

        {/* Encabezado + progreso */}
        <div style={{ flex: "none", background: "linear-gradient(160deg,#16325A,#0E2240)", color: "#fff", padding: mobile ? "calc(14px + env(safe-area-inset-top)) 16px 14px" : "18px 24px 16px", display: "flex", flexDirection: "column", gap: mobile ? 12 : 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(217,115,26,.18)", color: "#F0A35E", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{Ico.slice()}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: "#F0A35E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>DON TELMO® · 1958 · COMPANY</span>
              <span style={{ fontFamily: "var(--dt-serif)", fontSize: mobile ? 21 : 25, fontWeight: 600, lineHeight: 1.05 }}>Armar pizza</span>
            </div>
            <button onClick={close} aria-label="Cerrar" style={{ width: 42, height: 42, borderRadius: 12, border: 0, background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.close()}</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {["Tamaño", "División", "Sabores"].map((n, i) => {
              const k = i + 1, done = k < step, cur = k === step;
              return (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, flex: i < 2 ? 1 : "none", minWidth: 0 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: done ? "#D9731A" : cur ? "#fff" : "rgba(255,255,255,.14)", color: done ? "#fff" : cur ? "#0E2240" : "rgba(255,255,255,.6)", transition: "all .35s", boxShadow: cur ? "0 0 0 4px rgba(255,255,255,.14)" : "none" }}>{done ? Ico.check() : k}</span>
                  {(!mobile || cur) && <span style={{ fontSize: 12.5, fontWeight: 700, color: cur ? "#fff" : done ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.5)", whiteSpace: "nowrap" }}>{n}</span>}
                  {i < 2 && <span style={{ flex: 1, minWidth: 12, height: 2, borderRadius: 2, background: "rgba(255,255,255,.16)", position: "relative", overflow: "hidden" }}><span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: done ? "100%" : "0%", background: "#D9731A", transition: "width .5s cubic-bezier(.2,.8,.2,1)" }} /></span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: pad, position: "relative" }}>
          {step === 1 && (
            <div key="s1" style={{ display: "flex", flexDirection: "column", gap: 14, animation: stepAnim }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "var(--dt-serif)", fontSize: mobile ? 21 : 24, fontWeight: 600, color: "#0E2240" }}>¿De qué tamaño?</span>
                <span style={{ fontSize: 13, color: "#8A847A" }}>El dibujo está a escala real entre tamaños.</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0,1fr))", gap: 10 }}>
                {SIZE_ORDER.map((id, i) => {
                  const z = SIZES[id], on = size === id, box = mobile ? 78 : 150;
                  return (
                    <button key={id} className="pz-card" onClick={() => { if (size !== id) { setSize(id); setDiv(null); setAssigned([]); } }}
                      style={{ position: "relative", display: "flex", flexDirection: mobile ? "row" : "column", alignItems: "center", gap: mobile ? 14 : 12, padding: mobile ? "12px 14px" : "22px 16px 18px", borderRadius: 18, border: `2px solid ${on ? "#0E2240" : "#E7E1D7"}`, background: "#fff", cursor: "pointer", textAlign: mobile ? "left" : "center", boxShadow: on ? "0 18px 34px -20px rgba(14,34,64,.55)" : "none", transition: "all .3s cubic-bezier(.2,.8,.2,1)", animation: "dtUp .45s both", animationDelay: `${i * 60}ms`, fontFamily: "inherit" }}>
                      <span style={{ width: box, height: box, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${on ? 24 : 0}deg) scale(${on ? 1.06 : 1})`, transition: "transform .7s cubic-bezier(.2,.8,.2,1)" }}>
                        {pizzaEl({ uid: "z" + id, px: Math.round(box * z.cm / 50), parts: [z.portions], slices: true })}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: "var(--dt-serif)", fontSize: 21, fontWeight: 600, color: "#0E2240", lineHeight: 1.1 }}>{z.label}</span>
                        <span style={{ fontSize: 13, color: "#8A847A" }}>{z.cm} cm · {z.portions} porciones</span>
                      </span>
                      <span style={{ position: mobile ? "static" : "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: "50%", flex: "none", border: `2px solid ${on ? "#0E2240" : "#D6D0C6"}`, background: on ? "#0E2240" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .25s" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", transform: `scale(${on ? 1 : 0})`, transition: "transform .25s cubic-bezier(.2,.8,.2,1)" }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && sizeObj && (
            <div key="s2" style={{ display: "flex", flexDirection: "column", gap: 14, animation: stepAnim }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "var(--dt-serif)", fontSize: mobile ? 21 : 24, fontWeight: 600, color: "#0E2240" }}>¿Cómo la divides?</span>
                <span style={{ fontSize: 13, color: "#8A847A" }}>{sizeObj.label} · {sizeObj.cm} cm · {sizeObj.portions} porciones</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${mobile ? 140 : 160}px, 1fr))`, gap: 10 }}>
                {cfgs.map((c, i) => {
                  const on = div === i, p = c.p;
                  return (
                    <button key={c.id} className="pz-card" onClick={() => { if (div !== i) { setDiv(i); setAssigned(p.map(() => null)); } }}
                      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 10px 14px", borderRadius: 18, border: `2px solid ${on ? "#0E2240" : "#E7E1D7"}`, background: "#fff", cursor: "pointer", boxShadow: on ? "0 18px 34px -20px rgba(14,34,64,.55)" : "none", transition: "all .3s cubic-bezier(.2,.8,.2,1)", animation: "dtUp .45s both", animationDelay: `${i * 45}ms`, fontFamily: "inherit" }}>
                      {on && <span style={{ position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: "50%", background: "#0E2240", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", animation: "pzPop .35s both" }}>{Ico.check()}</span>}
                      <span style={{ display: "flex", transform: `scale(${on ? 1.06 : 1})`, transition: "transform .45s cubic-bezier(.2,.8,.2,1)" }}>
                        {pizzaEl({ uid: "d" + c.id, px: mobile ? 78 : 96, parts: p, tints: p.length > 1, anim: true })}
                      </span>
                      <span style={{ fontFamily: "var(--dt-serif)", fontSize: 19, fontWeight: 600, color: "#0E2240" }}>{p.length === 1 ? `${p[0]} porciones` : p.join(" + ")}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8A847A" }}>
                        <span style={{ display: "flex", gap: 3 }}>{p.map((_, k) => <span key={k} style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[k % 4][0] }} />)}</span>
                        {p.length === 1 ? "1 sabor" : `${p.length} sabores`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && cfg && (
            <div key="s3" style={{ display: "flex", flexDirection: "column", gap: 12, animation: stepAnim, minHeight: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: 999, background: "#0E2240", color: "#fff", fontSize: 12.5, fontWeight: 800 }}>{sizeObj.label} · {sizeObj.cm} cm</span>
                <span style={{ display: "flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: 999, background: "#fff", color: "#0E2240", fontSize: 12.5, fontWeight: 800, boxShadow: "0 0 0 1px #E7E1D7" }}>{nSec === 1 ? `${parts[0]} porciones` : parts.join(" + ")}</span>
                <span style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 2, height: 32, padding: "6px 12px", borderRadius: 999, background: "#fff", boxShadow: "0 0 0 1px #E7E1D7", fontSize: 12.5, fontWeight: 700, color: "#8A847A", boxSizing: "border-box" }}>
                  <strong style={{ fontSize: 15, color: complete ? "#1F9D6B" : "#0E2240", transition: "color .3s" }}>{filled}</strong>/{nSec} sabores
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: complete ? "#E8F8EE" : "#FFF6EE", border: `1.5px solid ${complete ? "#A8E0BF" : "#F6D3B3"}`, color: complete ? "#1B7A47" : "#B85E10", fontSize: 13, fontWeight: 600, transition: "all .35s" }}>
                {complete ? <span style={{ display: "flex", flex: "none" }}>{Ico.check(18, 2.6)}</span>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10M12 10V4.5a1.5 1.5 0 0 1 3 0V10M15 10V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15a1.5 1.5 0 0 1 2.4-1.8L9 16V11" /></svg>}
                <span>{complete ? <>¡Listo! <strong>Revisa los ingredientes</strong></> : <>Arrastra o toca un sabor → <strong>Sección {next + 1}</strong> — faltan {nSec - filled}</>}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: mobile ? "minmax(0,1fr)" : tabsMode ? "minmax(230px,270px) minmax(0,1fr)" : "minmax(250px,300px) minmax(210px,260px) minmax(0,1fr)", gridTemplateAreas: mobile ? "'pizza' 'tabs' 'body'" : tabsMode ? "'pizza tabs' 'pizza body'" : "'pizza flav ing'", gridTemplateRows: mobile ? "auto auto 1fr" : tabsMode ? "auto 1fr" : "auto", gap: mobile ? 12 : 18, alignItems: "start", flex: 1 }}>
                {/* Pizza + leyenda (zona para soltar) */}
                <div style={{ gridArea: "pizza", position: "sticky", top: mobile ? -14 : 0, zIndex: 5, display: "flex", flexDirection: mobile ? "row" : "column", alignItems: "center", gap: mobile ? 12 : 16, padding: mobile ? "10px 14px" : 0, margin: mobile ? "0 -14px" : 0, background: mobile ? "rgba(246,243,238,.94)" : "transparent", boxShadow: mobile ? "0 10px 16px -14px rgba(14,34,64,.35)" : "none" }}>
                  <div style={{ flex: "none", animation: complete ? "pzDone .7s cubic-bezier(.2,.8,.2,1) both" : "none" }}>
                    {pizzaEl({ uid: "main", px: pzPx, parts, fills: assigned.map((f, i) => (f ? COLORS[i % 4][0] : null)), flavors: flavorNames, labels: flavorNames.map(n => (n ? tc(n) : "")), hover: drag ? drag.over : null, next: drag ? null : next, interactive: true, nums: true })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", minWidth: 0 }}>
                    {parts.map((p, i) => {
                      const f = assigned[i], isOver = drag && drag.over === i, isNext = !drag && i === next, col = COLORS[i % 4];
                      return (
                        <div key={i} data-sec={String(i)} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: mobile ? 34 : 40, padding: "4px 6px 4px 10px", borderRadius: 11, background: f || isOver ? col[1] : "#fff", border: `1.5px ${f ? "solid" : "dashed"} ${f || isOver || isNext ? col[0] : "#E7E1D7"}`, transition: "all .25s", animation: isNext ? "pzBreath 1.6s ease-in-out infinite" : "none" }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: col[0], flex: "none" }} />
                          <span style={{ fontSize: mobile ? 12 : 12.5, fontWeight: 800, color: col[0], whiteSpace: "nowrap" }}>{mobile ? `S${i + 1}` : `Sección ${i + 1}`}</span>
                          <span style={{ fontSize: 11.5, color: "#8A847A", whiteSpace: "nowrap" }}>{p} porc.</span>
                          <span style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: mobile ? 12 : 12.5, fontWeight: 700, color: f ? col[0] : "#A39D92", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f ? tc(byId[f]?.name || "") : isOver ? "Suelta aquí" : "Vacía"}</span>
                          {f && <button onClick={(e) => { e.stopPropagation(); const b = [...assigned]; b[i] = null; update(b); }} aria-label="Quitar sabor" style={{ width: 28, height: 28, borderRadius: 8, border: 0, background: "transparent", color: col[0], cursor: "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{Ico.close(13)}</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {tabsMode && (
                  <div style={{ gridArea: "tabs", position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", padding: 4, borderRadius: 14, background: "#fff", boxShadow: "0 0 0 1px #E7E1D7" }}>
                    <span style={{ position: "absolute", top: 4, bottom: 4, left: 4, width: "calc(50% - 4px)", borderRadius: 10, background: "#0E2240", transform: `translateX(${tab === "ing" ? "100%" : "0%"})`, transition: "transform .35s cubic-bezier(.2,.8,.2,1)" }} />
                    <button onClick={() => setTab("sab")} style={{ position: "relative", height: 40, border: 0, background: "transparent", color: tab === "sab" ? "#fff" : "#6E6A63", fontWeight: 800, fontSize: 13.5, cursor: "pointer", transition: "color .3s", fontFamily: "inherit" }}>Sabores</button>
                    <button onClick={() => setTab("ing")} style={{ position: "relative", height: 40, border: 0, background: "transparent", color: tab === "ing" ? "#fff" : "#6E6A63", fontWeight: 800, fontSize: 13.5, cursor: "pointer", transition: "color .3s", fontFamily: "inherit" }}>Ingredientes ({ingCards.length})</button>
                  </div>
                )}

                {(!tabsMode || tab === "sab") && (
                  <div style={{ gridArea: tabsMode ? "body" : "flav", display: "flex", flexDirection: "column", gap: 12, minWidth: 0, animation: "dtFade .3s both" }}>
                    {groups.length === 0 && <div style={{ fontSize: 13, color: "#8A847A" }}>No hay sabores para este tamaño. Las recetas de pizza deben terminar en ({size}).</div>}
                    {groups.map(([title, color, fill, items]) => (
                      <div key={title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: ".18em", color }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="2" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
                          {title}
                        </span>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${mobile ? 140 : tabsMode ? 170 : 190}px, 1fr))`, gap: 6 }}>
                          {items.map(chip)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(!tabsMode || tab === "ing") && (
                  <div style={{ gridArea: tabsMode ? "body" : "ing", display: "flex", flexDirection: "column", gap: 10, minWidth: 0, animation: "dtFade .3s both" }}>
                    {!tabsMode && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 6, borderBottom: "1.5px solid #0E2240", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--dt-serif)", fontSize: 20, fontWeight: 600, color: "#0E2240" }}>Ingredientes</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#8A847A" }}>en vivo · ya multiplicados por porciones</span>
                      </div>
                    )}
                    {ingCards.length === 0 && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "34px 16px", borderRadius: 16, border: "1.5px dashed #DCD4C7", textAlign: "center", color: "#A39D92", fontSize: 13 }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4" /></svg>
                        Asigna un sabor y aquí verás sus ingredientes calculados.
                      </div>
                    )}
                    {ingCards.map(ic => (
                      <div key={ic.sec + ic.name} style={{ borderRadius: 16, overflow: "hidden", background: "#fff", border: `1.5px solid ${ic.color}`, animation: "dtUp .4s both" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 14px", background: ic.color, color: "#fff" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.85 }}>SEC {ic.sec + 1}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tc(ic.name)}</span>
                          <span style={{ height: 24, padding: "0 9px", borderRadius: 999, background: "rgba(255,255,255,.22)", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>{ic.portions} {ic.portions === 1 ? "porción" : "porciones"}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {ic.rows.length === 0 && <div style={{ padding: "10px 12px", fontSize: 13, color: "#A39D92" }}>Esta receta no tiene ingredientes cargados.</div>}
                          {ic.rows.map((r, k) => (
                            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 38, padding: "6px 12px", background: k % 2 ? "#fff" : ic.light }}>
                              {r.code && <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10.5, fontWeight: 700, color: "#B85E10", background: "#FBEBDD", padding: "2px 7px", borderRadius: 6, flex: "none" }}>{r.code}</span>}
                              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#3C3A36", lineHeight: 1.3 }}>
                                {r.qty ? <><strong style={{ color: "#0E2240", fontWeight: 800 }}>{r.qty}</strong><span style={{ fontSize: 11.5, color: "#8A847A" }}>{r.conv}</span> · {r.name}</> : r.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: `12px ${pad}px calc(12px + env(safe-area-inset-bottom))`, background: "#fff", borderTop: "1px solid #EFEAE2" }}>
          {step > 1 && (
            <button onClick={() => go(step - 1)} className="pz-out" style={{ height: 50, minWidth: 50, padding: mobile ? 0 : "0 20px", borderRadius: 14, border: "1.5px solid #E7E1D7", background: "#fff", color: "#0E2240", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
              {!mobile && <span>Volver</span>}
            </button>
          )}
          <button onClick={primary}
            style={{ flex: 1, height: 50, borderRadius: 14, border: step === 3 && complete ? "1.5px solid #1F9D6B" : 0, background: step === 3 ? (complete ? "#E8F8EE" : "#EFEAE2") : canNext ? "#0E2240" : "#D6D0C6", color: step === 3 ? (complete ? "#1B7A47" : "#A39D92") : "#fff", fontWeight: 800, fontSize: 15, cursor: canNext ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .3s cubic-bezier(.2,.8,.2,1)", fontFamily: "inherit" }}>
            {step === 3 && complete && <span style={{ display: "flex", animation: "pzPop .35s both" }}>{Ico.check(18, 2.8)}</span>}
            {step < 3 ? "Siguiente" : complete ? "Pizza lista" : (nSec - filled === 1 ? "Falta 1 sección" : `Faltan ${nSec - filled} secciones`)}
            {step < 3 && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
          </button>
          {step === 3 && (
            <>
              <button onClick={() => setTicket(true)} aria-label="Imprimir ticket 80 mm" title="Imprimir (térmica 80 mm)" disabled={!filled}
                style={{ width: 50, height: 50, borderRadius: 14, border: 0, background: "#0E2240", color: "#fff", cursor: "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", opacity: filled ? 1 : 0.35, pointerEvents: filled ? "auto" : "none", transition: "all .25s" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></svg>
              </button>
              <button onClick={doPDF} aria-label="Descargar PDF" title="Descargar PDF" disabled={!filled || pdfLoading}
                style={{ width: 50, height: 50, borderRadius: 14, border: 0, background: "#D9731A", color: "#fff", cursor: pdfLoading ? "wait" : "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", opacity: filled && !pdfLoading ? 1 : 0.35, pointerEvents: filled ? "auto" : "none", transition: "all .25s" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3" /></svg>
              </button>
            </>
          )}
        </div>

        {/* Vista previa del ticket 80 mm */}
        {ticket && (
          <div onClick={() => setTicket(false)} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(14,34,64,.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, animation: "dtFade .2s both" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 302, maxWidth: "100%", maxHeight: "calc(100% - 90px)", overflowY: "auto", background: "#fff", padding: "18px 16px 22px", fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 12, color: "#111", lineHeight: 1.5, boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)", animation: "dtPop .35s both", clipPath: "polygon(0 0,100% 0,100% 100%,95% 98.6%,90% 100%,85% 98.6%,80% 100%,75% 98.6%,70% 100%,65% 98.6%,60% 100%,55% 98.6%,50% 100%,45% 98.6%,40% 100%,35% 98.6%,30% 100%,25% 98.6%,20% 100%,15% 98.6%,10% 100%,5% 98.6%,0 100%)" }}>
              <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14 }}>DON TELMO® 1958</div>
              <div style={{ textAlign: "center" }}>ARMADOR DE PIZZAS</div>
              <div style={{ borderTop: "1px dashed #111", margin: "8px 0" }} />
              <div style={{ fontWeight: 700 }}>PIZZA {sizeObj?.label.toUpperCase()} {sizeObj?.cm} CM</div>
              <div>División: {nSec === 1 ? `${parts[0]} porciones` : parts.join(" + ")}</div>
              {ingCards.map(ic => (
                <div key={ic.sec} style={{ borderTop: "1px dashed #111", marginTop: 8, paddingTop: 8 }}>
                  <div style={{ fontWeight: 700 }}>SEC {ic.sec + 1} · {ic.name.toUpperCase()} ({ic.portions} porc.)</div>
                  {ic.rows.map((r, k) => (
                    <div key={k} style={{ display: "flex", gap: 6 }}><span style={{ flex: 1 }}>{String(r.name).toUpperCase()}</span><span style={{ whiteSpace: "nowrap" }}>{r.qty}</span></div>
                  ))}
                </div>
              ))}
              <div style={{ borderTop: "1px dashed #111", margin: "10px 0 6px" }} />
              <div style={{ textAlign: "center", fontSize: 11 }}>Ancho 80 mm · {new Date().toLocaleDateString("es-CO")}</div>
            </div>
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setTicket(false)} style={{ height: 46, padding: "0 18px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,.35)", background: "transparent", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Cerrar</button>
              <button onClick={() => printPizzaThermal(sizeObj, cfg, liveResults)} style={{ height: 46, padding: "0 20px", borderRadius: 12, border: 0, background: "#fff", color: "#0E2240", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Imprimir</button>
            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: "absolute", left: "50%", bottom: 92, zIndex: 25, display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 18px", borderRadius: 999, background: "#0E2240", color: "#fff", fontSize: 13.5, fontWeight: 700, boxShadow: "0 16px 30px -12px rgba(14,34,64,.6)", whiteSpace: "nowrap", animation: "pzToast 2.4s both" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#1F9D6B", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{Ico.check(12, 3.4)}</span>
            {toast}
          </div>
        )}
      </div>

      {/* Fantasma del arrastre */}
      {drag && (() => {
        const z = vp.zoom || 1, over = drag.over, col = over != null ? COLORS[over % 4][0] : "#0E2240";
        return (
          <div style={{ position: "fixed", left: drag.x / z, top: drag.y / z, zIndex: 1000, pointerEvents: "none", transform: `translate(-50%, ${drag.touch ? "-135%" : "-60%"}) rotate(-4deg)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 16px", borderRadius: 13, background: col, color: "#fff", fontSize: 14, fontWeight: 800, boxShadow: "0 22px 40px -12px rgba(14,34,64,.55), 0 0 0 3px rgba(255,255,255,.9)", whiteSpace: "nowrap", transition: "background .2s" }}>
              {Ico.grip("rgba(255,255,255,.7)")}{tc(byId[drag.id]?.name || "")}
            </div>
            <span style={{ height: 22, padding: "0 10px", borderRadius: 999, background: "#fff", color: over != null ? col : "#6E6A63", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", boxShadow: "0 6px 14px -6px rgba(0,0,0,.3)" }}>{over != null ? `→ Sección ${over + 1}` : "Suelta sobre la pizza"}</span>
          </div>
        );
      })()}
    </div>
  );
}
