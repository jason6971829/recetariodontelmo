// Repara nombres (y textos de ingredientes) con mojibake:
// UTF-8 mal decodificado como Latin-1/CP1252. Ej: "AD. CHAMPIÃ‘ON" -> "AD. CHAMPIÑON".
//
// USO:
//   node scripts/fix-mojibake.js           -> DRY RUN
//   node scripts/fix-mojibake.js --apply    -> escribe en Supabase
//
// Requiere .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (o ANON).

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

// Reemplazos de secuencias mojibake -> caracter correcto.
// El orden importa: primero las de 2+ chars.
const MAP = [
  ["Ã‘", "Ñ"], ["Ã±", "ñ"],
  ["Ã¡", "á"], ["Ã©", "é"], ["Ã­", "í"], ["Ã³", "ó"], ["Ãº", "ú"], ["Ã¼", "ü"],
  ["Ã", "Á"], ["Ã‰", "É"], ["Ã", "Í"], ["Ã“", "Ó"], ["Ãš", "Ú"],
  ["Â¿", "¿"], ["Â¡", "¡"], ["Âº", "º"], ["Âª", "ª"],
];

function fix(s) {
  if (typeof s !== "string") return s;
  let out = s;
  for (const [bad, good] of MAP) out = out.split(bad).join(good);
  return out;
}

function fixIngredient(ing) {
  if (ing && typeof ing === "object") {
    const text = fix(ing.text ?? ing.name ?? "");
    if (ing.text != null) return { ...ing, text };
    if (ing.name != null) return { ...ing, name: text };
    return ing;
  }
  return fix(ing);
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

  const recipes = await fetch(
    `${SUPABASE_URL}/rest/v1/recipes?select=id,name,ingredients,description,preparation,recommendations`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  ).then(r => r.json());
  console.log(`${recipes.length} recetas cargadas\n`);

  let namesFixed = 0, ingsFixed = 0, textFixed = 0, recipesChanged = 0;
  const sample = [];

  for (const r of recipes) {
    const patch = {};
    const newName = fix(r.name);
    if (newName !== r.name) { patch.name = newName; namesFixed++; }

    if (Array.isArray(r.ingredients)) {
      const newIngs = r.ingredients.map(fixIngredient);
      const before = JSON.stringify(r.ingredients);
      const after = JSON.stringify(newIngs);
      if (before !== after) {
        patch.ingredients = newIngs;
        // contar cuantos strings de ingrediente cambiaron
        r.ingredients.forEach((ing, i) => {
          const a = typeof ing === "string" ? ing : JSON.stringify(ing);
          const b = typeof newIngs[i] === "string" ? newIngs[i] : JSON.stringify(newIngs[i]);
          if (a !== b) ingsFixed++;
        });
      }
    }

    for (const field of ["description", "preparation", "recommendations"]) {
      if (typeof r[field] === "string") {
        const nf = fix(r[field]);
        if (nf !== r[field]) { patch[field] = nf; textFixed++; }
      }
    }

    if (Object.keys(patch).length) {
      recipesChanged++;
      if (sample.length < 12 && patch.name) sample.push(`${r.name}  ->  ${patch.name}`);
      if (APPLY) await sb("PATCH", `recipes?id=eq.${r.id}`, patch);
    }
  }

  console.log("Resumen:");
  console.log(`  Recetas modificadas: ${recipesChanged}`);
  console.log(`  Nombres corregidos: ${namesFixed}`);
  console.log(`  Ingredientes corregidos: ${ingsFixed}`);
  console.log(`  Campos de texto corregidos (desc/prep/reco): ${textFixed}`);

  if (sample.length && !APPLY) {
    console.log("\nMuestra de nombres:");
    sample.forEach(s => console.log("  " + s));
  }
  console.log(APPLY ? "\nListo." : "\nPara aplicar: node scripts/fix-mojibake.js --apply");
})().catch(e => { console.error("\nError:", e.message); process.exit(1); });
