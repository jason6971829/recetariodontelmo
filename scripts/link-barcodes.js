// Contrato v5: vincula recetas <-> productos por BARCODE.
//
// Hace DOS cosas, en orden seguro para no duplicar:
//   A) BACKFILL: por cada producto con barcode, si ya existe una receta con
//      el mismo nombre (normalizado) y sin barcode, le escribe el barcode.
//   B) STUBS: por cada producto con tiene_receta:false Y barcode != null que
//      NO tenga receta (ni por barcode ya asignado ni por nombre), crea una
//      receta-borrador (titulo + barcode + categoria, ingredientes vacios,
//      published:false) lista para llenar.
//
// Idempotente: re-correrlo no duplica (salta lo ya vinculado).
//
// USO:
//   node scripts/link-barcodes.js           -> DRY RUN
//   node scripts/link-barcodes.js --apply    -> escribe en Supabase
//
// Requiere .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (o ANON),
//   GABYCONTROL_API_URL, INSUMOS_API_KEY.

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
const GABY_URL = process.env.GABYCONTROL_API_URL || "https://gabycontrol.vercel.app";
const INSUMOS_KEY = process.env.INSUMOS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !INSUMOS_KEY) {
  console.error("Faltan env vars (SUPABASE_URL / SERVICE_KEY / INSUMOS_API_KEY)");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");

function normName(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();
}

async function sb(method, path_, body) {
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

  // 1) Productos de gabycontrol
  const productos = await fetch(`${GABY_URL}/api/productos`, { headers: { "X-API-Key": INSUMOS_KEY } })
    .then(r => r.json());
  console.log(`${productos.length} productos leidos de gabycontrol`);

  // 2) Recetas nuestras
  const recipes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,name,barcode,category`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  ).then(r => r.json());
  console.log(`${recipes.length} recetas en el recetario\n`);

  const byBarcode = new Set(recipes.filter(r => r.barcode).map(r => String(r.barcode)));
  const byName = new Map();
  recipes.forEach(r => { if (!byName.has(normName(r.name))) byName.set(normName(r.name), r); });

  let backfilled = 0, stubs = 0, skippedLinked = 0, skippedNoBarcode = 0;
  const backfillSample = [], stubSample = [];

  for (const p of productos) {
    const bc = p.barcode != null ? String(p.barcode) : null;
    if (!bc) { skippedNoBarcode++; continue; }

    // Ya hay una receta con ese barcode -> nada que hacer
    if (byBarcode.has(bc)) { skippedLinked++; continue; }

    // Hay receta con el mismo nombre y sin barcode -> BACKFILL
    const match = byName.get(normName(p.nombre));
    if (match && !match.barcode) {
      backfilled++;
      if (backfillSample.length < 5) backfillSample.push(`${p.nombre} <- barcode ${bc}`);
      if (APPLY) await sb("PATCH", `recipes?id=eq.${match.id}`, { barcode: bc });
      byBarcode.add(bc);
      continue;
    }
    if (match && match.barcode) { skippedLinked++; continue; } // ya tiene otro barcode

    // No hay receta -> STUB solo si el producto no tiene receta del lado gabycontrol
    if (p.tiene_receta === false) {
      stubs++;
      if (stubSample.length < 8) stubSample.push(`${p.nombre} (${p.categoria}) barcode ${bc}`);
      if (APPLY) await sb("POST", "recipes", {
        name: p.nombre,
        category: p.categoria || "SIN CATEGORIA",
        barcode: bc,
        ingredients: [],
        portions: "",
        published: false,
      });
      byBarcode.add(bc);
    }
  }

  console.log("Resumen:");
  console.log(`  Backfill (barcode a receta existente por nombre): ${backfilled}`);
  console.log(`  Stubs creados (producto sin receta): ${stubs}`);
  console.log(`  Saltados (ya vinculados): ${skippedLinked}`);
  console.log(`  Saltados (producto sin barcode): ${skippedNoBarcode}`);

  if (!APPLY) {
    if (backfillSample.length) {
      console.log("\nMuestra backfill:");
      backfillSample.forEach(s => console.log("  " + s));
    }
    if (stubSample.length) {
      console.log("\nMuestra stubs a crear:");
      stubSample.forEach(s => console.log("  " + s));
    }
    console.log("\nPara aplicar: node scripts/link-barcodes.js --apply");
  } else {
    console.log("\nListo.");
  }
})().catch(e => { console.error("\nError:", e.message); process.exit(1); });
