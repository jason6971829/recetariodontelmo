// Auto-clasifica las recetas de "RECETAS BODEGA" en sub-categorias por
// reglas simples de prefijo del nombre. El usuario puede reclasificar a
// mano despues desde el editor.
//
// USO:
//   node scripts/classify-bodega.js           -> DRY RUN
//   node scripts/classify-bodega.js --apply   -> escribe en Supabase
//
// Requiere que la columna recipes.subcategory exista (text nullable).

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY en .env.local");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const CATEGORY = "RECETAS BODEGA";

// Reglas ordenadas (primera que matchea gana). Patrones en mayusculas, sin "S. "
const RULES = [
  ["Apanados",                /APANAD|^ARITOS|^DEDITOS|^NUGGETS/],
  ["Concentrados y pulpas",   /^CONCENTRADO|^PULPA/],
  ["Panes",                   /^PAN\b/],
  ["Pastas y masas",          /^PASTA|^MASA/],
  ["Guisos",                  /^GUISO|^COMPLEMENTOS GUISADOS|^MIX GUISADO|^MIXCAZUELA|^YUCA GUISO|^MOJOSY|POLLO DESMECHADO AJIACO/i],
  ["Salsas, aceites y sazonadores", /^ACEITE|^BBQ|^BOLOGNESA|^CARBONARA|^CHIMICHURRI|^CHILI|^SALSA|^SAL\b|^SUERO|^PESTO|^SHOWY|^MARINADA|^VINAGRETA|^MAYONESA|^ALIOLI/],
  ["Bases y caldos",          /^AJIACO|^BASE|^CALDO|^FONDO|^SOPA/],
  ["Carnes y proteinas",      /^CARNE|^CERDO|^CHURRASCO|^CHICHARRON|^BABY BEEF|^BIRRIA|^ALAS|^CAMARON|^POLLO|^PECHUGA|^HAMBURGUESA POLLO|^MOJARRA|^SALMON|^PUNTA DE ANCA|^LENGUA|^SOBREBARRIGA|^RACK|^LOMO|^SOLOMITO|^COSTILLA/],
  ["Vegetales",               /^CEBOLLA|^PAPA|YUCA|^MAIZ|^MAZORCA|^JALAPE|^PEPINILLOS|^PLATANO|^TOMATE|^PIMIENT|^PATACON|^PI[NÑ]A/],
  ["Quesos",                  /^QUESO/],
];

function classify(name) {
  const clean = String(name).replace(/^S\.\s*/i, "").toUpperCase().trim();
  for (const [cat, rx] of RULES) {
    if (rx.test(clean)) return cat;
  }
  return "Otros";
}

async function api(method, path_, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path_}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path_} -> ${res.status} ${await res.text()}`);
}

(async () => {
  console.log(`Modo: ${APPLY ? "APLICAR" : "DRY RUN"}\n`);

  const recipes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,name,subcategory&category=eq.${encodeURIComponent(CATEGORY)}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  ).then(r => r.json());

  console.log(`${recipes.length} recetas en categoria "${CATEGORY}"\n`);

  const counts = {};
  const samples = {};
  let toUpdate = 0;

  for (const r of recipes) {
    const sub = classify(r.name);
    counts[sub] = (counts[sub] || 0) + 1;
    if (!samples[sub]) samples[sub] = [];
    if (samples[sub].length < 3) samples[sub].push(r.name);
    if (r.subcategory !== sub) {
      toUpdate++;
      if (APPLY) await api("PATCH", `recipes?id=eq.${r.id}`, { subcategory: sub });
    }
  }

  console.log("Distribucion:");
  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    console.log(`  ${k.padEnd(22)} ${v}`);
    if (!APPLY) samples[k].forEach(n => console.log(`    - ${n}`));
  });
  console.log(`\nA actualizar: ${toUpdate}`);
  console.log(APPLY ? "\nListo." : "\nPara aplicar: node scripts/classify-bodega.js --apply");
})().catch(e => { console.error(e); process.exit(1); });
