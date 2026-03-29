/**
 * exportDoc.js
 * Genera un documento Word (.doc) con todas las recetas del recetario.
 * Usa HTML compatible con Word (mso namespace) — sin dependencias extra.
 */

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(str) {
  if (!str) return "";
  return esc(str).replace(/\n/g, "<br>");
}

function formatIngredients(ingredients) {
  if (!ingredients || ingredients.length === 0) return "<p style='color:#888'>Sin ingredientes registrados.</p>";
  return `
    <table style="width:100%;border-collapse:collapse;margin:4px 0;">
      <tr style="background:#f5f0ea;">
        <th style="padding:6px 10px;text-align:left;font-size:11px;color:#5a3e2b;border-bottom:2px solid #d4a574;">INGREDIENTE</th>
        <th style="padding:6px 10px;text-align:center;font-size:11px;color:#5a3e2b;border-bottom:2px solid #d4a574;">CANTIDAD</th>
        <th style="padding:6px 10px;text-align:center;font-size:11px;color:#5a3e2b;border-bottom:2px solid #d4a574;">UNIDAD</th>
      </tr>
      ${ingredients.map((ing, i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#faf7f3"}">
          <td style="padding:5px 10px;font-size:12px;border-bottom:1px solid #e8e0d5;">${esc(ing.name || ing)}</td>
          <td style="padding:5px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e8e0d5;">${esc(ing.quantity || "")}</td>
          <td style="padding:5px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e8e0d5;">${esc(ing.unit || "")}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

function recipeSection(recipe, index) {
  const hasImage = recipe.image && recipe.image.startsWith("http");
  return `
    <div style="page-break-before:${index === 0 ? "avoid" : "always"};padding:32px 40px;font-family:Georgia,serif;">
      <!-- Encabezado de receta -->
      <div style="border-bottom:3px solid #d4a574;padding-bottom:12px;margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;">
        <div style="flex:1;">
          <div style="font-size:10px;color:#d4721a;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">${esc(recipe.category || "Sin categoría")}</div>
          <h2 style="font-size:22px;color:#1b3a5c;margin:0 0 8px 0;">${esc(recipe.name)}</h2>
          <div style="display:flex;gap:20px;flex-wrap:wrap;">
            ${recipe.prepTime ? `<span style="font-size:11px;color:#666;">🕐 Prep: <strong>${esc(recipe.prepTime)}</strong></span>` : ""}
            ${recipe.cookTime ? `<span style="font-size:11px;color:#666;">🔥 Cocción: <strong>${esc(recipe.cookTime)}</strong></span>` : ""}
            ${recipe.portions ? `<span style="font-size:11px;color:#666;">🍽️ Porciones: <strong>${esc(recipe.portions)}</strong></span>` : ""}
          </div>
        </div>
        ${hasImage ? `
          <div style="flex-shrink:0;">
            <img src="${recipe.image}" alt="${esc(recipe.name)}"
              style="width:140px;height:100px;object-fit:cover;border-radius:10px;border:2px solid #e8e0d5;"
              onerror="this.style.display='none'" />
          </div>
        ` : ""}
      </div>

      <!-- Descripción -->
      ${recipe.description ? `
        <div style="margin-bottom:18px;">
          <h3 style="font-size:12px;color:#d4721a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px 0;border-left:3px solid #d4721a;padding-left:8px;">📝 DESCRIPCIÓN</h3>
          <p style="font-size:13px;color:#333;line-height:1.7;margin:0;">${nl2br(recipe.description)}</p>
        </div>
      ` : ""}

      <!-- Ingredientes -->
      <div style="margin-bottom:18px;">
        <h3 style="font-size:12px;color:#d4721a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px 0;border-left:3px solid #d4721a;padding-left:8px;">🥕 INGREDIENTES</h3>
        ${formatIngredients(recipe.ingredients)}
      </div>

      <!-- Preparación -->
      ${recipe.preparation ? `
        <div style="margin-bottom:18px;">
          <h3 style="font-size:12px;color:#d4721a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px 0;border-left:3px solid #d4721a;padding-left:8px;">🍳 PREPARACIÓN</h3>
          <p style="font-size:13px;color:#333;line-height:1.7;margin:0;white-space:pre-line;">${nl2br(recipe.preparation)}</p>
        </div>
      ` : ""}

      <!-- Recomendaciones -->
      ${recipe.recommendations ? `
        <div style="margin-bottom:18px;background:#fef9f0;border:1px solid #f0e0c0;border-radius:8px;padding:14px 16px;">
          <h3 style="font-size:12px;color:#d4721a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px 0;">💡 RECOMENDACIONES DEL CHEF</h3>
          <p style="font-size:13px;color:#333;line-height:1.7;margin:0;">${nl2br(recipe.recommendations)}</p>
        </div>
      ` : ""}

      <!-- Aprende a vender -->
      ${recipe.salesPitch ? `
        <div style="margin-bottom:18px;background:#f0f6ff;border:1px solid #c0d8f0;border-radius:8px;padding:14px 16px;">
          <h3 style="font-size:12px;color:#1b3a5c;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px 0;">🎯 APRENDE A VENDER</h3>
          <p style="font-size:13px;color:#333;line-height:1.7;margin:0;">${nl2br(recipe.salesPitch)}</p>
        </div>
      ` : ""}

      <!-- Video -->
      ${recipe.video ? `
        <div style="margin-bottom:8px;font-size:12px;color:#666;">
          🎥 Video tutorial: <a href="${esc(recipe.video)}" style="color:#1b3a5c;">${esc(recipe.video)}</a>
        </div>
      ` : ""}

      <!-- Número de receta -->
      <div style="text-align:right;font-size:10px;color:#bbb;margin-top:12px;">Receta #${index + 1}</div>
    </div>
  `;
}

function buildIndexHtml(recipes) {
  // Agrupar por categoría
  const byCategory = {};
  recipes.forEach(r => {
    const cat = r.category || "Sin categoría";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  });

  return Object.entries(byCategory).map(([cat, recs]) => `
    <tr>
      <td colspan="2" style="padding:8px 10px;background:#f5f0ea;font-size:11px;font-weight:700;color:#d4721a;letter-spacing:2px;text-transform:uppercase;">${esc(cat)}</td>
    </tr>
    ${recs.map(r => `
      <tr>
        <td style="padding:5px 10px 5px 20px;font-size:13px;color:#1b3a5c;border-bottom:1px solid #f0ebe3;">${esc(r.name)}</td>
        <td style="padding:5px 10px;font-size:12px;color:#888;text-align:right;border-bottom:1px solid #f0ebe3;">
          ${r.prepTime || r.cookTime ? `${r.prepTime || ""} ${r.cookTime ? "/ " + r.cookTime : ""}`.trim() : "—"}
        </td>
      </tr>
    `).join("")}
  `).join("");
}

export function exportToWord(recipes, brandName = "Recetario", brandLabel = "RECETARIO DIGITAL", brandIcon = null) {
  const date = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  const total = recipes.length;

  // Agrupar categorías para portada
  const cats = [...new Set(recipes.map(r => r.category).filter(Boolean))];

  const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${esc(brandName)} — Recetario Digital</title>
  <style>
    @page { margin: 2cm 2.5cm; size: A4; }
    body { font-family: Georgia, serif; color: #333; margin: 0; padding: 0; }
    h1, h2, h3 { margin: 0; }
    table { border-collapse: collapse; }
    @media print {
      .no-print { display: none; }
      div[style*="page-break-before:always"] { page-break-before: always; }
    }
  </style>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
</head>
<body>

  <!-- ══ PORTADA ══ -->
  <div style="page-break-after:always;min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 40px;background:linear-gradient(180deg,#faf7f3 0%,#fff 100%);">
    ${brandIcon ? `<img src="${brandIcon}" alt="Logo" style="width:100px;height:100px;object-fit:contain;border-radius:16px;margin-bottom:24px;" onerror="this.style.display='none'" />` : `<div style="font-size:60px;margin-bottom:24px;">🍽️</div>`}
    <div style="font-size:11px;color:#d4721a;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:8px;">${esc(brandLabel)}</div>
    <h1 style="font-size:36px;color:#1b3a5c;margin:0 0 12px 0;">${esc(brandName)}</h1>
    <div style="font-size:14px;color:#888;margin-bottom:40px;">Recetario Digital Completo</div>
    <div style="border:1px solid #e8e0d5;border-radius:12px;padding:20px 40px;display:inline-block;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
      <div style="font-size:28px;font-weight:700;color:#d4721a;">${total}</div>
      <div style="font-size:12px;color:#888;letter-spacing:1px;">RECETAS</div>
      ${cats.length > 0 ? `<div style="margin-top:12px;font-size:11px;color:#aaa;">${cats.map(esc).join(" · ")}</div>` : ""}
    </div>
    <div style="margin-top:48px;font-size:11px;color:#ccc;">Generado el ${date}</div>
  </div>

  <!-- ══ ÍNDICE ══ -->
  <div style="page-break-after:always;padding:40px;">
    <div style="border-bottom:3px solid #1b3a5c;padding-bottom:12px;margin-bottom:24px;">
      <div style="font-size:10px;color:#d4721a;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">CONTENIDO</div>
      <h2 style="font-size:26px;color:#1b3a5c;margin:0;">Índice de Recetas</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${buildIndexHtml(recipes)}
    </table>
  </div>

  <!-- ══ RECETAS ══ -->
  ${recipes.map((recipe, i) => recipeSection(recipe, i)).join("\n")}

</body>
</html>
  `.trim();

  // Crear blob y disparar descarga
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${brandName.replace(/[^a-z0-9áéíóúñ ]/gi, "").trim() || "Recetario"}_${new Date().getFullYear()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
