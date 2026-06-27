// Importa las 79 subrecetas de produccion ("Recetas Bodega") preparadas por
// el chat de gabycontrol. Idempotente: si una receta (name + category) ya existe
// la actualiza; si no, la inserta.
//
// USO:
//   node scripts/import-bodega.js              -> DRY RUN
//   node scripts/import-bodega.js --apply      -> escribe en Supabase
//
// Fuente: C:/Users/jjson/gabycontrol/docs/recetas_bodega_export.json
// Spec  : C:/Users/jjson/gabycontrol/docs/recetas_bodega_handoff.md

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
const SOURCE = "C:/Users/jjson/gabycontrol/docs/recetas_bodega_export.json";
const CATEGORY = "RECETAS BODEGA";

// Parseo del string "cant UNIDAD - nombre | codigo" a objeto {code, text}
// para que coincida con el shape que ya usan las recetas tras apply-codes.js
function parseIngredient(s) {
  const str = String(s).trim();
  const m = str.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
  if (m) return { code: m[2], text: m[1].trim() };
  return { code: "", text: str };
}

async function api(method, path_, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path_}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" || method === "PATCH" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path_} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

(async () => {
  console.log(`Conectando a ${SUPABASE_URL}`);
  console.log(`Modo: ${APPLY ? "APLICAR" : "DRY RUN"}\n`);

  if (!fs.existsSync(SOURCE)) {
    console.error(`No encuentro el JSON: ${SOURCE}`);
    process.exit(1);
  }
  const bodega = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
  console.log(`${bodega.length} recetas bodega leidas del JSON`);

  const existing = await api("GET", `recipes?select=id,name,category&category=eq.${encodeURIComponent(CATEGORY)}`);
  const byName = new Map(existing.map(r => [r.name, r.id]));
  console.log(`${existing.length} recetas ya en la DB con category="${CATEGORY}"\n`);

  let toInsert = 0, toUpdate = 0, errors = 0;
  const sample = [];

  for (const r of bodega) {
    const row = {
      name: r.nombre,
      category: CATEGORY,
      portions: `${r.tanda_tipica} ${r.unidad_salida}`,
      ingredients: r.ingredientes.map(parseIngredient),
      published: true,
    };
    const existingId = byName.get(r.nombre);
    const action = existingId ? "UPDATE" : "INSERT";
    if (existingId) toUpdate++; else toInsert++;
    if (sample.length < 3) sample.push({ action, name: r.nombre, portions: row.portions, ingredients: row.ingredients.length });

    if (APPLY) {
      try {
        if (existingId) {
          await api("PATCH", `recipes?id=eq.${existingId}`, row);
        } else {
          await api("POST", "recipes", row);
        }
        process.stdout.write(".");
      } catch (e) {
        errors++;
        console.error(`\nError ${action} "${r.nombre}": ${e.message}`);
      }
    }
  }
  if (APPLY) console.log("");

  console.log("\nResumen:");
  console.log(`  Insert: ${toInsert}`);
  console.log(`  Update: ${toUpdate}`);
  console.log(`  Total : ${toInsert + toUpdate}`);
  if (errors) console.log(`  Errores: ${errors}`);

  if (!APPLY) {
    console.log("\nMuestra:");
    sample.forEach(s => console.log(`  [${s.action}] ${s.name}  -> portions="${s.portions}", ${s.ingredients} ingredientes`));
    console.log("\nPara aplicar: node scripts/import-bodega.js --apply");
  }
})().catch(e => {
  console.error("\nError:", e.message);
  process.exit(1);
});
