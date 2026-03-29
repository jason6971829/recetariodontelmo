/**
 * importExcel.js
 * Lee una plantilla Excel (.xlsx) y convierte las filas en objetos de receta.
 * Compatible con la plantilla generada por exportTemplate.js
 */

// xlsx se carga de forma diferida (solo cuando el usuario importa)
let _XLSX = null;
async function getXLSX() {
  if (!_XLSX) _XLSX = await import("xlsx");
  return _XLSX;
}

const COL_INDEX = {
  name:            0,  // A
  category:        1,  // B
  prepTime:        2,  // C
  cookTime:        3,  // D
  portions:        4,  // E
  description:     5,  // F
  ingredients:     6,  // G
  preparation:     7,  // H
  recommendations: 8,  // I
  salesPitch:      9,  // J
  video:           10, // K
};

function str(v) {
  return v != null ? String(v).trim() : "";
}

function parseIngredients(raw) {
  if (!raw) return [];
  return str(raw)
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split("|").map(p => p.trim());
      if (parts.length >= 3) {
        return { quantity: parts[0], unit: parts[1], name: parts[2] };
      }
      // Formato libre sin pipes → todo va al nombre
      return { quantity: "", unit: "", name: line };
    })
    .filter(ing => ing.name);
}

export async function importFromExcel(file) {
  const XLSX = await getXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array", cellText: true, cellDates: false });

        // Buscar la hoja de recetas
        const sheetName = wb.SheetNames.find(n =>
          n.toLowerCase().includes("receta") || n.toLowerCase().includes("recipe")
        ) || wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        if (!ws) { reject(new Error("No se encontró la hoja de recetas")); return; }

        // Convertir a array de arrays
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });

        // Detectar fila de inicio de datos:
        // Buscar la fila que tiene "NOMBRE" en la columna A (encabezado)
        let dataStart = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const cell = str(rows[i][0]).toUpperCase();
          if (cell.includes("NOMBRE")) { dataStart = i + 1; break; }
        }
        // Si no encontró encabezado, asumir que los datos empiezan en la fila 3
        // (fila 4 de Excel = índice 3, saltando título + grupos + encabezado)
        if (dataStart === -1) dataStart = 3;

        const recipes = [];
        for (let i = dataStart; i < rows.length; i++) {
          const row = rows[i];
          const name = str(row[COL_INDEX.name]);
          if (!name) continue; // fila vacía o fila de ejemplo

          // Detectar y saltar la fila de ejemplo
          const cat = str(row[COL_INDEX.category]);
          if (name.toLowerCase().includes("ejemplo") ||
              cat.toLowerCase().includes("ejemplo")) continue;

          recipes.push({
            name,
            category:        str(row[COL_INDEX.category]),
            prepTime:        str(row[COL_INDEX.prepTime]),
            cookTime:        str(row[COL_INDEX.cookTime]),
            portions:        str(row[COL_INDEX.portions]),
            description:     str(row[COL_INDEX.description]),
            ingredients:     parseIngredients(row[COL_INDEX.ingredients]),
            preparation:     str(row[COL_INDEX.preparation]),
            recommendations: str(row[COL_INDEX.recommendations]),
            salesPitch:      str(row[COL_INDEX.salesPitch]),
            video:           str(row[COL_INDEX.video]),
            image:           null,
            published:       false,
          });
        }

        resolve(recipes);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}
