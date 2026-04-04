async function loadImageAsDataUrl(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateRecipePDF(recipe) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, PH = 297, ML = 14, MR = 14;
  const CW = PW - ML - MR;
  const FOOT = 20;
  let y = 0;

  const C = {
    primary:   [27,  58,  92],
    primaryDk: [18,  40,  65],
    orange:    [212, 114, 26],
    white:     [255, 255, 255],
    light:     [244, 240, 235],
    lightAlt:  [255, 255, 255],
    lightBlue: [160, 190, 220],
    dark:      [51,  51,  51],
    border:    [220, 215, 205],
    blue:      [44,  100, 140],
    brown:     [120, 85,  45],
    chipBg:    [45,  72,  108],
  };

  /* ── HEADER ── */
  doc.setFillColor(...C.primaryDk);
  doc.rect(0, 0, PW, 52, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.orange);
  doc.text("DON TELMO\u00AE \u2014 1958 \u2014 COMPANY", ML, 11);

  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  const nameLines = doc.splitTextToSize(recipe.name.toUpperCase(), CW);
  doc.text(nameLines, ML, 20);
  let hy = 20 + nameLines.length * 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.lightBlue);
  doc.text(recipe.category.toUpperCase(), ML, hy + 3);
  hy += 8;

  const chips = [
    ["PREP",      recipe.prepTime  || "\u2014"],
    ["COCCI\u00D3N",  recipe.cookTime  || "\u2014"],
    ["PORCIONES", recipe.portions  || "\u2014"],
  ];
  chips.forEach(([label, value], i) => {
    const cx = ML + i * 60;
    doc.setFillColor(...C.chipBg);
    doc.roundedRect(cx, hy, 55, 10, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...C.lightBlue);
    doc.text(label, cx + 3, hy + 4);
    doc.setFontSize(8.5);
    doc.setTextColor(...C.white);
    doc.text(String(value), cx + 3, hy + 9);
  });

  y = 56;

  /* ── IMAGEN ── */
  if (recipe.image) {
    const imgData = await loadImageAsDataUrl(recipe.image);
    if (imgData) {
      doc.addImage(imgData, "JPEG", ML, y, CW, 72, "", "FAST");
      y += 78;
    }
  }

  /* ── HELPERS ── */
  function ensureSpace(needed) {
    if (y + needed > PH - FOOT) { doc.addPage(); y = 15; }
  }

  function sectionTitle(text, color) {
    ensureSpace(14);
    doc.setFillColor(...color);
    doc.rect(ML, y, CW, 8, "F");
    // acento naranja a la izquierda
    doc.setFillColor(...C.orange);
    doc.rect(ML, y, 3, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.white);
    doc.text(text, ML + 6, y + 5.5);
    y += 9;
  }

  function textLine(text, alt) {
    const wrapped = doc.splitTextToSize(text, CW - 8);
    const boxH = wrapped.length * 5 + 3;
    ensureSpace(boxH + 1);
    doc.setFillColor(...(alt ? C.light : C.lightAlt));
    doc.rect(ML, y, CW, boxH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.dark);
    wrapped.forEach((line, li) => {
      doc.text(line, ML + 4, y + 4.5 + li * 5);
    });
    y += boxH;
  }

  function textBlock(text) {
    const wrapped = doc.splitTextToSize(text, CW - 8);
    doc.setFillColor(...C.light);
    wrapped.forEach((line) => {
      ensureSpace(6);
      doc.setFillColor(...C.light);
      doc.rect(ML, y, CW, 5.8, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C.dark);
      doc.text(line, ML + 4, y + 4.2);
      y += 5.5;
    });
    y += 3;
  }

  /* ── INGREDIENTES ── */
  if (recipe.ingredients?.length > 0) {
    sectionTitle("INGREDIENTES", C.primary);
    recipe.ingredients.forEach((ing, i) => textLine("\u2022  " + ing, i % 2 === 0));
    y += 5;
  }

  /* ── PREPARACI\u00D3N ── */
  if (recipe.preparation) {
    sectionTitle("PREPARACI\u00D3N", C.primary);
    textBlock(recipe.preparation);
  }

  /* ── DESCRIPCI\u00D3N ── */
  if (recipe.description) {
    sectionTitle("DESCRIPCI\u00D3N", C.blue);
    textBlock(recipe.description);
  }

  /* ── RECOMENDACIONES ── */
  if (recipe.recommendations) {
    sectionTitle("RECOMENDACIONES", C.brown);
    textBlock(recipe.recommendations);
  }

  /* ── APRENDE A VENDER ── */
  if (recipe.salesPitch) {
    sectionTitle("APRENDE A VENDER", C.orange);
    textBlock(recipe.salesPitch);
  }

  /* ── FOOTER en todas las páginas ── */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.primaryDk);
    doc.rect(0, PH - 11, PW, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.orange);
    doc.text("\u2501\u2501\u2501  DON TELMO\u00AE  1958  \u2501\u2501\u2501", PW / 2, PH - 4, { align: "center" });
    if (total > 1) {
      doc.setFontSize(6.5);
      doc.setTextColor(...C.lightBlue);
      doc.text(`${p} / ${total}`, PW - ML, PH - 4, { align: "right" });
    }
  }

  /* ── GUARDAR ── */
  const safeName = recipe.name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "").trim()
    .replace(/\s+/g, "_")
    .substring(0, 60);
  doc.save(safeName + ".pdf");
}
