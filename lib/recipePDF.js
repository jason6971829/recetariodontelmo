async function loadImageAsDataUrl(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    // Obtener dimensiones reales para respetar el aspect ratio
    const dims = await new Promise((resolve) => {
      const img = new window.Image();
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
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
  doc.text("DON TELMO(R) -- 1958 -- COMPANY", ML, 11);

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
    ["PREP",      recipe.prepTime  || "-"],
    ["COCCION",   recipe.cookTime  || "-"],
    ["PORCIONES", recipe.portions  || "-"],
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
    const imgInfo = await loadImageAsDataUrl(recipe.image);
    if (imgInfo) {
      const { dataUrl, w, h } = imgInfo;
      const maxW = CW, maxH = 85;
      const ratio = w / h;
      let imgW = maxW, imgH = maxW / ratio;
      if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
      const imgX = ML + (CW - imgW) / 2;
      doc.addImage(dataUrl, "JPEG", imgX, y, imgW, imgH, "", "FAST");
      y += imgH + 6;
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
    recipe.ingredients.forEach((ing, i) => textLine("*  " + ing, i % 2 === 0));
    y += 5;
  }

  /* ── PREPARACI\u00D3N ── */
  if (recipe.preparation) {
    sectionTitle("PREPARACION", C.primary);
    textBlock(recipe.preparation);
  }

  /* ── DESCRIPCI\u00D3N ── */
  if (recipe.description) {
    sectionTitle("DESCRIPCION", C.blue);
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
    doc.text("--- DON TELMO(R) 1958 ---", PW / 2, PH - 4, { align: "center" });
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

/* ─────────────────────────────────────────────────────────
   PDF Armador de Pizzas
   liveResults: [{ name, portions, color, light, ingredients }]
   size: { label, cm, portions }
   cfg:  { label, sub, p }
───────────────────────────────────────────────────────── */
/* Dibuja la pizza con secciones coloreadas en un canvas y devuelve dataURL */
async function drawPizzaCanvas(portions, sectionData) {
  const SZ = 400;
  const canvas = document.createElement("canvas");
  canvas.width = SZ; canvas.height = SZ;
  const ctx = canvas.getContext("2d");
  const cx = SZ / 2, cy = SZ / 2, r = SZ / 2 - 4;

  // Cargar imagen base
  const baseInfo = await loadImageAsDataUrl("/pizza-base.png");
  if (baseInfo) {
    const img = new window.Image();
    await new Promise(res => { img.onload = res; img.onerror = res; img.src = baseInfo.dataUrl; });
    // objectFit: cover + objectPosition: center 60%
    const scale = Math.max(SZ / img.naturalWidth, SZ / img.naturalHeight) * 1.15;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = (SZ - dw) / 2;
    const dy = (SZ - dh) * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#c8774d";
    ctx.fill();
  }

  const total = portions.reduce((a, b) => a + b, 0);
  let deg = 0;
  const slices = portions.map((p) => {
    const s = deg; deg += (p / total) * 360;
    return { s, e: deg };
  });

  // Overlay de color por sección
  slices.forEach(({ s, e }, i) => {
    const sd = sectionData[i];
    if (!sd) return;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, ((s - 90) * Math.PI) / 180, ((e - 90) * Math.PI) / 180);
    ctx.closePath();
    ctx.fillStyle = sd.color + "99";
    ctx.fill();
  });

  // Líneas divisorias
  if (portions.length > 1) {
    slices.forEach(({ s }) => {
      const rad = ((s - 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 4;
      ctx.stroke();
    });
  }

  // Borde exterior
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Etiquetas de sabor
  deg = 0;
  portions.forEach((p, i) => {
    const s = deg; deg += (p / total) * 360;
    const mid = s + (p / total) * 180;
    const lx = cx + r * 0.58 * Math.cos(((mid - 90) * Math.PI) / 180);
    const ly = cy + r * 0.58 * Math.sin(((mid - 90) * Math.PI) / 180);
    const sd = sectionData[i];
    if (!sd) return;
    const words = sd.name.split(" ");
    const fs = SZ < 200 ? 11 : 16;
    ctx.font = `bold ${fs}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    words.forEach((w, wi) => {
      const ty = ly + (wi - (words.length - 1) / 2) * (fs + 3);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 5;
      ctx.strokeText(w, lx, ty);
      ctx.fillStyle = "#fff";
      ctx.fillText(w, lx, ty);
    });
  });

  return canvas.toDataURL("image/png");
}

export async function generatePizzaPDF({ size, cfg, liveResults }) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210, PH = 297, ML = 14, MR = 14;
  const CW = PW - ML - MR;
  const FOOT = 20;
  let y = 0;

  const SEC_COLORS_HEX = ["#D4721A","#1A6B9E","#27ae60","#8e44ad","#e67e22","#c0392b"];
  const C = {
    primaryDk: [18,40,65], primary:[27,58,92], orange:[212,114,26],
    white:[255,255,255], light:[244,240,235], lightBlue:[160,190,220],
    dark:[51,51,51], chipBg:[45,72,108],
  };

  function hexToRgb(hex) {
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  }
  function ensureSpace(n) { if (y + n > PH - FOOT) { doc.addPage(); y = 15; } }

  /* ── HEADER ── */
  doc.setFillColor(...C.primaryDk);
  doc.rect(0, 0, PW, 44, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(7);
  doc.setTextColor(...C.orange);
  doc.text("DON TELMO(R) -- 1958 -- COMPANY", ML, 11);
  doc.setFontSize(18); doc.setTextColor(...C.white);
  doc.text("ARMADOR DE PIZZAS", ML, 22);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(...C.lightBlue);
  doc.text(size.label.toUpperCase()+" "+size.cm+"CM  |  "+cfg.label+"  |  "+cfg.sub.toUpperCase(), ML, 31);
  [["TAMANO",size.label],["DIAMETRO",size.cm+" cm"],["DIVISIONES",cfg.sub]].forEach(([lbl,val],i) => {
    const cx2 = ML + i * 62;
    doc.setFillColor(...C.chipBg);
    doc.roundedRect(cx2, 33, 58, 9, 1.5, 1.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.setTextColor(...C.lightBlue);
    doc.text(lbl, cx2+3, 37);
    doc.setFontSize(8); doc.setTextColor(...C.white);
    doc.text(String(val), cx2+3, 41);
  });
  y = 48;

  /* ── PIZZA VISUAL (canvas) ── */
  const sectionDataForCanvas = liveResults.map((r, i) => ({ name: r.name, color: SEC_COLORS_HEX[i % SEC_COLORS_HEX.length] }));
  const pizzaImgUrl = await drawPizzaCanvas(cfg.p, sectionDataForCanvas);
  const pizzaMm = 82;
  doc.addImage(pizzaImgUrl, "PNG", (PW - pizzaMm) / 2, y, pizzaMm, pizzaMm, "", "FAST");
  y += pizzaMm + 5;

  /* ── LEYENDA DE SABORES ── */
  ensureSpace(12);
  doc.setFillColor(240, 236, 230);
  doc.rect(ML, y, CW, 10, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...C.primary);
  doc.text("SABORES SELECCIONADOS", ML+4, y+6.5);
  y += 11;

  const colW = CW / Math.min(liveResults.length, 3);
  liveResults.forEach((sec, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = ML + col * colW;
    const by = y + row * 12;
    ensureSpace(14);
    const rgb = hexToRgb(SEC_COLORS_HEX[i % SEC_COLORS_HEX.length]);
    doc.setFillColor(...rgb);
    doc.roundedRect(bx, by, colW - 2, 10, 1.5, 1.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...C.white);
    doc.text("Sec "+(i+1)+": "+sec.name, bx+4, by+6.5);
  });
  y += Math.ceil(liveResults.length / 3) * 12 + 6;

  /* ── SEPARADOR ── */
  doc.setDrawColor(...C.orange);
  doc.setLineWidth(0.5);
  doc.line(ML, y, PW-MR, y);
  y += 6;

  /* ── INGREDIENTES POR SECCIÓN ── */
  liveResults.forEach((sec, idx) => {
    const rgb = hexToRgb(SEC_COLORS_HEX[idx % SEC_COLORS_HEX.length]);
    const lightRgb = [Math.min(255,rgb[0]+155), Math.min(255,rgb[1]+155), Math.min(255,rgb[2]+155)];

    ensureSpace(16);
    doc.setFillColor(...rgb);
    doc.rect(ML, y, CW, 9, "F");
    doc.setFillColor(...C.orange);
    doc.rect(ML, y, 3, 9, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...C.white);
    doc.text(sec.name.toUpperCase(), ML+6, y+6);
    doc.setFontSize(8); doc.setTextColor(220,220,220);
    doc.text(sec.portions+" porc.", PW-MR, y+6, { align:"right" });
    y += 10;

    sec.ingredients.forEach((ing, j) => {
      const wrapped = doc.splitTextToSize("*  "+ing, CW-6);
      const boxH = wrapped.length * 5 + 2;
      ensureSpace(boxH+1);
      doc.setFillColor(...(j%2===0 ? lightRgb : C.white));
      doc.rect(ML, y, CW, boxH, "F");
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...C.dark);
      wrapped.forEach((line,li) => doc.text(line, ML+4, y+4.5+li*5));
      y += boxH;
    });
    y += 6;
  });

  /* ── FOOTER ── */
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...C.primaryDk);
    doc.rect(0, PH-11, PW, 11, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...C.orange);
    doc.text("--- DON TELMO(R) 1958 ---", PW/2, PH-4, { align:"center" });
    if (total > 1) { doc.setFontSize(6.5); doc.setTextColor(...C.lightBlue); doc.text(`${p} / ${total}`, PW-ML, PH-4, { align:"right" }); }
  }

  doc.save("Pizza_"+size.label+"_"+cfg.label+".pdf");
}
