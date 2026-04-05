/**
 * thermalPrint.js
 * Genera una impresión optimizada para impresora térmica de 80mm de cocina.
 * Abre una ventana nueva con HTML formateado y lanza window.print().
 *
 * @param {object} recipe  — objeto receta
 * @param {object} [brand] — datos de marca (label, name, tagline)
 */
export function printRecipeThermal(recipe, brand = {}) {
  const brandHeader = brand.label   || "DON TELMO® — 1958 — COMPANY";
  const brandName   = brand.name    || "Don Telmo®";
  const tagline     = brand.tagline || "1958 — Company";

  const printDate = new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  /* ── helpers ── */
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const section = (title, content) =>
    content
      ? `<div class="section-title">${esc(title)}</div>
         <div class="section-body">${esc(content)}</div>`
      : "";

  const ingredientRows = (recipe.ingredients ?? [])
    .map((ing, i) =>
      `<div class="ing-row${i % 2 === 0 ? " alt" : ""}">• ${esc(ing)}</div>`
    )
    .join("");

  const chips = [
    ["PREP",      recipe.prepTime  || "--"],
    ["COCCION",   recipe.cookTime  || "--"],
    ["PORCIONES", recipe.portions  || "--"],
  ]
    .map(([l, v]) =>
      `<span class="chip"><span class="chip-label">${esc(l)}</span><br>${esc(v)}</span>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${esc(recipe.name)}</title>
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Pagina 80mm, alto automatico ── */
    @page {
      size: 80mm auto;
      margin: 4mm 3mm;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9pt;
      color: #000;
      width: 74mm;
      background: #fff;
    }

    /* ── Header ── */
    .brand-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 5pt;
      margin-bottom: 5pt;
    }
    .brand-label {
      font-size: 7pt;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .recipe-name {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      line-height: 1.2;
      margin: 4pt 0 2pt;
      word-break: break-word;
    }
    .category {
      font-size: 7pt;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* ── Chips de tiempos ── */
    .chips-row {
      display: flex;
      gap: 3pt;
      flex-wrap: wrap;
      margin: 5pt 0;
    }
    .chip {
      border: 1px solid #000;
      border-radius: 3pt;
      padding: 2pt 4pt;
      font-size: 7pt;
      line-height: 1.4;
      flex: 1;
      text-align: center;
    }
    .chip-label {
      font-weight: bold;
      font-size: 6pt;
      letter-spacing: 1px;
    }

    /* ── Secciones ── */
    .section-title {
      font-size: 8pt;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-bottom: 1px solid #000;
      padding-bottom: 1pt;
      margin-top: 6pt;
      margin-bottom: 3pt;
    }
    .section-body {
      font-size: 8.5pt;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Ingredientes ── */
    .ing-row {
      font-size: 8.5pt;
      padding: 1.5pt 2pt;
      line-height: 1.4;
    }
    .ing-row.alt {
      background: #ebebeb;
    }

    /* ── Caja de ventas ── */
    .sales-title {
      font-size: 8pt;
      font-weight: bold;
      letter-spacing: 1px;
      border-bottom: 1px solid #000;
      padding-bottom: 1pt;
      margin-top: 6pt;
      margin-bottom: 3pt;
    }
    .sales-box {
      border: 1px solid #000;
      padding: 4pt 5pt;
      font-size: 8.5pt;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Divisor ── */
    .divider {
      border-top: 1px dashed #000;
      margin: 5pt 0;
    }

    /* ── Footer ── */
    .print-footer {
      border-top: 2px solid #000;
      padding-top: 4pt;
      margin-top: 8pt;
      text-align: center;
      font-size: 7pt;
      line-height: 1.6;
    }

    /* ── Evitar cortes dentro de secciones ── */
    .section-body, .sales-box, .ing-row { page-break-inside: avoid; }
  </style>
</head>
<body>

  <div class="brand-header">
    <div class="brand-label">${esc(brandHeader)}</div>
    <div class="recipe-name">${esc(recipe.name)}</div>
    <div class="category">${esc(recipe.category ?? "")}</div>
  </div>

  <div class="chips-row">${chips}</div>
  <div class="divider"></div>

  ${(recipe.ingredients ?? []).length > 0
    ? `<div class="section-title">INGREDIENTES</div>${ingredientRows}<div class="divider"></div>`
    : ""}

  ${recipe.preparation
    ? `${section("PREPARACION", recipe.preparation)}<div class="divider"></div>`
    : ""}

  ${recipe.recommendations
    ? `${section("RECOMENDACIONES", recipe.recommendations)}<div class="divider"></div>`
    : ""}

  ${recipe.salesPitch
    ? `<div class="sales-title">APRENDE A VENDER</div>
       <div class="sales-box">${esc(recipe.salesPitch)}</div>
       <div class="divider"></div>`
    : ""}

  <div class="print-footer">
    --- ${esc(brandName)} --- ${esc(tagline)} ---<br>
    Impreso: ${esc(printDate)}
  </div>

</body>
</html>`;

  const win = window.open("", "_blank", "width=420,height=620");
  if (!win) {
    alert("Permite las ventanas emergentes en el navegador para imprimir.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();

  // Timeout corto para que el navegador termine de parsear el HTML
  // antes de abrir el dialogo de impresion (evita pagina en blanco en Chrome/Firefox)
  setTimeout(() => {
    win.print();
    // Opcional: cerrar ventana despues de imprimir
    // win.onafterprint = () => win.close();
  }, 300);
}

/**
 * printPizzaThermal
 * Impresion termica 80mm del armado de pizza completo.
 *
 * @param {object} size        — { label, cm, portions }
 * @param {object} cfg         — { label, sub, p: [] }
 * @param {Array}  liveResults — [{ name, portions, ingredients:[] }, ...]
 * @param {object} [brand]     — { label, name, tagline }
 */
export function printPizzaThermal(size, cfg, liveResults, brand = {}) {
  const brandHeader = brand.label   || "DON TELMO® — 1958 — COMPANY";
  const brandName   = brand.name    || "Don Telmo®";
  const tagline     = brand.tagline || "1958 — Company";

  const printDate = new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const sectionsHTML = liveResults.map((r, i) => `
    <div class="section-block">
      <div class="section-header">
        <span class="section-num">${i + 1}</span>
        ${esc(r.name)}
        <span class="section-porc">${r.portions} porc.</span>
      </div>
      ${r.ingredients.map((ing, j) =>
        `<div class="ing-row${j % 2 === 0 ? " alt" : ""}">• ${esc(ing)}</div>`
      ).join("")}
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Pizza ${esc(size.label)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 80mm auto; margin: 4mm 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9pt;
      color: #000;
      width: 74mm;
      background: #fff;
    }
    .brand-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 5pt;
      margin-bottom: 5pt;
    }
    .brand-label { font-size: 7pt; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
    .pizza-title { font-size: 13pt; font-weight: bold; text-transform: uppercase; margin: 4pt 0 1pt; }
    .pizza-sub   { font-size: 7pt; letter-spacing: 1px; }
    .divider { border-top: 1px dashed #000; margin: 5pt 0; }
    .section-block { margin-bottom: 6pt; }
    .section-header {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      background: #fff;
      color: #000;
      padding: 3pt 5pt;
      border: 2px solid #000;
      border-bottom: 2px solid #000;
      border-radius: 0;
      display: flex;
      align-items: center;
      gap: 5pt;
    }
    .section-num {
      background: #000;
      color: #fff;
      font-size: 8pt;
      font-weight: 800;
      border-radius: 50%;
      width: 14pt;
      height: 14pt;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .section-porc {
      margin-left: auto;
      font-size: 7pt;
      font-weight: normal;
      opacity: 0.85;
      flex-shrink: 0;
    }
    .ing-row {
      font-size: 8.5pt;
      padding: 2pt 5pt;
      line-height: 1.4;
      border: 1px solid #ddd;
      border-top: none;
    }
    .ing-row.alt { background: #ebebeb; }
    .ing-row:last-child { border-radius: 0 0 3pt 3pt; }
    .print-footer {
      border-top: 2px solid #000;
      padding-top: 4pt;
      margin-top: 8pt;
      text-align: center;
      font-size: 7pt;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="brand-header">
    <div class="brand-label">${esc(brandHeader)}</div>
    <div class="pizza-title">🍕 Pizza ${esc(size.label)}</div>
    <div class="pizza-sub">${esc(size.cm)} cm · ${esc(String(size.portions))} porciones · ${esc(cfg.label)}</div>
  </div>

  ${sectionsHTML}

  <div class="print-footer">
    --- ${esc(brandName)} --- ${esc(tagline)} ---<br>
    Impreso: ${esc(printDate)}
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=420,height=620");
  if (!win) { alert("Permite las ventanas emergentes en el navegador para imprimir."); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}
