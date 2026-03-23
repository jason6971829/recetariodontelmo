/**
 * Seed script — Inserta las 336 recetas iniciales en Supabase
 *
 * Uso:
 *   node scripts/seed.js
 *
 * Requiere variables de entorno:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Puedes pasarlas inline:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... node scripts/seed.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Cargar .env.local si existe
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    const [key, ...vals] = line.split("=");
    if (key && vals.length) process.env[key.trim()] = vals.join("=").trim();
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key || url.includes("TU-PROYECTO")) {
  console.error("❌ Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

// Cargar SEED_RECIPES del archivo de datos
// El archivo usa export const, así que lo parseamos manualmente
const dataFile = fs.readFileSync(path.join(__dirname, "..", "data", "seed-recipes.js"), "utf8");
const jsonStart = dataFile.indexOf("[");
const jsonEnd = dataFile.lastIndexOf("]") + 1;
const SEED_RECIPES = JSON.parse(dataFile.slice(jsonStart, jsonEnd));

async function seed() {
  console.log(`🌱 Insertando ${SEED_RECIPES.length} recetas en Supabase...`);

  // Mapear a formato de DB
  const rows = SEED_RECIPES.map(r => ({
    name: r.name,
    category: r.category,
    prep_time: r.prepTime || "",
    cook_time: r.cookTime || "",
    portions: r.portions || "",
    ingredients: r.ingredients || [],
    preparation: r.preparation || "",
    recommendations: r.recommendations || "",
    image_url: null,
    video: r.video || "",
  }));

  // Insertar en lotes de 50
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("recipes").insert(batch);
    if (error) {
      console.error(`❌ Error en lote ${i}-${i + batch.length}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  ✅ ${inserted}/${rows.length} recetas insertadas`);
    }
  }

  console.log(`\n🎉 Seed completado: ${inserted} recetas insertadas`);
}

seed().catch(console.error);
