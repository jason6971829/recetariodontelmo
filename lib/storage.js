import { supabase } from "@/lib/supabase";
import { cacheRecipes, getCachedRecipes, cacheUsers, getCachedUsers, addToQueue, isOnline } from "@/lib/offlineQueue";

// ── Recetas ──────────────────────────────────────────────────────

export async function getRecipes() {
  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("id", { ascending: true });
    if (error) throw error;
    const recipes = data.map(dbToRecipe);
    cacheRecipes(recipes); // Guardar en cache local
    return recipes;
  } catch (err) {
    console.error("getRecipes error:", err);
    // Si falla (offline), usar cache local
    const cached = getCachedRecipes();
    if (cached) { console.log("📦 Usando recetas del cache local"); return cached; }
    return null;
  }
}

export async function upsertRecipe(recipe) {
  const row = recipeToDb(recipe);
  try {
    const { data, error } = await supabase
      .from("recipes")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    const updated = dbToRecipe(data);
    // Actualizar cache local
    const cached = getCachedRecipes() || [];
    cacheRecipes(cached.map(r => r.id === updated.id ? updated : r));
    return updated;
  } catch (err) {
    console.error("upsertRecipe offline:", err);
    // Guardar en cola offline
    addToQueue({ type: "upsert_recipe", data: row });
    // Actualizar cache local
    const cached = getCachedRecipes() || [];
    const recipeData = dbToRecipe(row);
    cacheRecipes(cached.map(r => r.id === recipeData.id ? recipeData : r));
    return recipeData;
  }
}

export async function insertRecipe(recipe) {
  const row = recipeToDb(recipe);
  delete row.id;
  try {
    const { data, error } = await supabase
      .from("recipes")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    const newRecipe = dbToRecipe(data);
    const cached = getCachedRecipes() || [];
    cacheRecipes([...cached, newRecipe]);
    return newRecipe;
  } catch (err) {
    console.error("insertRecipe offline:", err);
    const tempId = Date.now();
    addToQueue({ type: "insert_recipe", data: { ...row, tempId } });
    const tempRecipe = dbToRecipe({ ...row, id: tempId });
    const cached = getCachedRecipes() || [];
    cacheRecipes([...cached, tempRecipe]);
    return tempRecipe;
  }
}

export async function deleteRecipe(id) {
  try {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) throw error;
    const cached = getCachedRecipes() || [];
    cacheRecipes(cached.filter(r => r.id !== id));
    return true;
  } catch (err) {
    console.error("deleteRecipe offline:", err);
    addToQueue({ type: "delete_recipe", data: { id } });
    const cached = getCachedRecipes() || [];
    cacheRecipes(cached.filter(r => r.id !== id));
    return true;
  }
}

// ── Usuarios ─────────────────────────────────────────────────────

export async function getUsers() {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("id", { ascending: true });
    if (error) throw error;
    cacheUsers(data);
    return data;
  } catch (err) {
    console.error("getUsers error:", err);
    const cached = getCachedUsers();
    if (cached) { console.log("📦 Usando usuarios del cache local"); return cached; }
    return null;
  }
}

export async function saveUsers(users) {
  // Obtener usuarios actuales para detectar eliminados
  const { data: existing } = await supabase.from("users").select("id");
  const existingIds = (existing || []).map(u => u.id);
  const newIds = users.filter(u => u.id).map(u => u.id);

  // Eliminar los que ya no están en la lista
  const toDelete = existingIds.filter(id => !newIds.includes(id));
  if (toDelete.length > 0) {
    await supabase.from("users").delete().in("id", toDelete);
  }

  // Batch upsert existentes (con id) y batch insert nuevos (sin id) — 1 request en vez de N
  const toUpsert = users.filter(u => u.id);
  const toInsert = users.filter(u => !u.id).map(({ id, ...rest }) => rest);

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("users").upsert(toUpsert, { onConflict: "id" });
    if (error) console.error("saveUsers upsert error:", error);
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from("users").insert(toInsert);
    if (error) console.error("saveUsers insert error:", error);
  }
  return true;
}

// ── Categorías ───────────────────────────────────────────────────

export async function getCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) { console.error("getCategories error:", error); return null; }
  return data;
}

export async function upsertCategory(category) {
  const { error } = await supabase
    .from("categories")
    .upsert(category, { onConflict: "id" });
  if (error) { console.error("upsertCategory error:", error); return false; }
  return true;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) { console.error("deleteCategory error:", error); return false; }
  return true;
}

// ── Configuración global (sincronizada en Supabase Storage) ──────

export async function saveWatermarkConfig(config) {
  try {
    const blob = new Blob([JSON.stringify(config)], { type: "application/json" });
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload("watermark/config.json", blob, { upsert: true, cacheControl: "0", contentType: "application/json" });
    if (error) { console.error("saveWatermarkConfig error:", error); return false; }
    return true;
  } catch (err) { console.error("saveWatermarkConfig exception:", err); return false; }
}

export async function loadWatermarkConfig(signal) {
  try {
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl("watermark/config.json");
    const res = await fetch(urlData.publicUrl, { cache: "default", signal });
    if (!res.ok) return null;
    const config = await res.json();
    // Si no hay logo guardado, buscar custom-watermark en paralelo
    if (!config.logo) {
      const logo = await findCustomWatermarkUrl(signal);
      if (logo) config.logo = logo;
    }
    return config;
  } catch (err) {
    if (err?.name === "AbortError") return null;
    console.error("loadWatermarkConfig error:", err); return null;
  }
}

async function findCustomWatermarkUrl(signal) {
  const exts = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
  const checks = exts.map(ext => {
    const { data } = supabase.storage.from("recipe-images").getPublicUrl(`watermark/custom-watermark.${ext}`);
    return fetch(data.publicUrl, { method: "HEAD", cache: "no-cache", signal })
      .then(r => r.ok ? data.publicUrl : Promise.reject())
      .catch(() => Promise.reject());
  });
  try { return await Promise.any(checks); } catch { return null; }
}

// ── Imágenes (Supabase Storage) ──────────────────────────────────

export async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `recipes/${fileName}`;

  const { error } = await supabase.storage
    .from("recipe-images")
    .upload(filePath, file, { cacheControl: "86400", upsert: false }); // 24h — filenames son únicos

  if (error) { console.error("uploadImage error:", error); return null; }

  const { data: urlData } = supabase.storage
    .from("recipe-images")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

export async function deleteImage(imageUrl) {
  if (!imageUrl) return;
  // Extraer path del URL: .../recipe-images/recipes/filename.jpg
  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split("/recipe-images/");
    if (parts.length < 2) return;
    const filePath = parts[1];
    await supabase.storage.from("recipe-images").remove([filePath]);
  } catch {}
}

// ── Passkeys (acceso biométrico) ─────────────────────────────────

export async function savePasskey(credentialId, userId) {
  const { error } = await supabase
    .from("passkeys")
    .upsert({ credential_id: credentialId, user_id: userId }, { onConflict: "credential_id" });
  if (error) { console.error("savePasskey error:", error); return false; }
  return true;
}

export async function getPasskeyUser(credentialId) {
  const { data, error } = await supabase
    .from("passkeys")
    .select("user_id, users(*)")
    .eq("credential_id", credentialId)
    .single();
  if (error || !data) { console.error("getPasskeyUser error:", error); return null; }
  return data.users;
}

// ── Actividad (tracking) ─────────────────────────────────────────

export async function logActivity(userId, action, recipeName = null, category = null) {
  const { error } = await supabase
    .from("activity_log")
    .insert({ user_id: userId, action, recipe_name: recipeName, category });
  if (error) console.error("logActivity error:", error);
}

export async function getActivityReport() {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*, users(name, username, role, sede)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) { console.error("getActivityReport error:", error); return []; }
  return data;
}

// ── Banner de anuncios ────────────────────────────────────────────

export async function saveBannerConfig(config) {
  try {
    const blob = new Blob([JSON.stringify(config)], { type: "application/json" });
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload("banner/config.json", blob, { upsert: true, cacheControl: "0", contentType: "application/json" });
    if (error) { console.error("saveBannerConfig error:", error); return false; }
    return true;
  } catch (err) { console.error("saveBannerConfig exception:", err); return false; }
}

export async function loadBannerConfig(signal) {
  try {
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl("banner/config.json");
    const res = await fetch(urlData.publicUrl, { cache: "default", signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    if (err?.name === "AbortError") return null;
    console.error("loadBannerConfig error:", err); return null;
  }
}

// ── Perfil / Contacto ────────────────────────────────────────────

export async function saveProfileConfig(config) {
  try {
    const blob = new Blob([JSON.stringify(config)], { type: "application/json" });
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload("profile/config.json", blob, { upsert: true, cacheControl: "0", contentType: "application/json" });
    if (error) { console.error("saveProfileConfig error:", error); return false; }
    return true;
  } catch (err) { console.error("saveProfileConfig exception:", err); return false; }
}

export async function loadProfileConfig(signal) {
  try {
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl("profile/config.json");
    const res = await fetch(urlData.publicUrl, { cache: "default", signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    if (err?.name === "AbortError") return null;
    console.error("loadProfileConfig error:", err); return null;
  }
}

// ── Configuración de App (tema + marca) ─────────────────────────

export async function saveAppConfig(config) {
  try {
    // Si el ícono es base64 (data:...) NO lo guardamos en el JSON:
    // ya está subido como archivo en brand/brand-icon.* en Supabase.
    // Guardamos solo URLs públicas para que el JSON sea pequeño y funcione
    // en todos los dispositivos.
    const toSave = { ...config };
    if (toSave.brand) {
      const icon = toSave.brand.icon || "";
      toSave.brand = {
        ...toSave.brand,
        icon: icon.startsWith("data:") ? null : icon,
      };
    }
    const blob = new Blob([JSON.stringify(toSave)], { type: "application/json" });
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload("app/config.json", blob, { upsert: true, cacheControl: "0", contentType: "application/json" });
    if (error) { console.error("saveAppConfig error:", error); return false; }
    return true;
  } catch (err) { console.error("saveAppConfig exception:", err); return false; }
}

// Busca el ícono del logo en paralelo — todos los formatos al mismo tiempo
async function findBrandIconUrl(signal) {
  const exts = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
  const checks = exts.map(ext => {
    const { data } = supabase.storage.from("recipe-images").getPublicUrl(`brand/brand-icon.${ext}`);
    return fetch(data.publicUrl, { method: "HEAD", cache: "no-cache", signal })
      .then(r => r.ok ? data.publicUrl : Promise.reject())
      .catch(() => Promise.reject());
  });
  try { return await Promise.any(checks); } catch { return null; }
}

export async function loadAppConfig(signal) {
  try {
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl("app/config.json");
    const res = await fetch(urlData.publicUrl, { cache: "default", signal });

    // Si app/config.json no existe todavía, igual intentamos cargar el ícono
    // buscando brand/brand-icon.* directamente en Supabase
    if (!res.ok) {
      const icon = await findBrandIconUrl(signal);
      if (icon) return { brand: { icon } };
      return null;
    }

    const config = await res.json();
    // Si el JSON existe pero no tiene ícono, buscarlo en Supabase directamente
    if (!config.brand?.icon) {
      const icon = await findBrandIconUrl(signal);
      if (icon) {
        if (!config.brand) config.brand = {};
        config.brand.icon = icon;
      }
    }
    return config;
  } catch (err) {
    if (err?.name === "AbortError") return null;
    console.error("loadAppConfig error:", err); return null;
  }
}

// ── Insumos (Catálogo maestro) ───────────────────────────────────

export async function getSupplies() {
  try {
    const { data, error } = await supabase
      .from("supplies")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getSupplies error:", err);
    return [];
  }
}

export async function saveSupply(supply) {
  const row = { ...supply, updated_at: new Date().toISOString() };
  if (!row.id) delete row.id;
  const { data, error } = row.id
    ? await supabase.from("supplies").update(row).eq("id", row.id).select().single()
    : await supabase.from("supplies").insert(row).select().single();
  if (error) { console.error("saveSupply error:", error); return null; }
  return data;
}

export async function deleteSupply(id) {
  const { error } = await supabase.from("supplies").delete().eq("id", id);
  if (error) { console.error("deleteSupply error:", error); return false; }
  return true;
}

// ── Costeo de Recetas (Escandallo) ──────────────────────────────

export async function getRecipeCosts() {
  try {
    const { data, error } = await supabase
      .from("recipe_costs")
      .select("*");
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getRecipeCosts error:", err);
    return [];
  }
}

export async function getRecipeCost(recipeId) {
  try {
    const { data, error } = await supabase
      .from("recipe_costs")
      .select("*")
      .eq("recipe_id", recipeId)
      .single();
    if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
    return data || null;
  } catch (err) {
    console.error("getRecipeCost error:", err);
    return null;
  }
}

export async function saveRecipeCost(cost) {
  const row = { ...cost, updated_at: new Date().toISOString() };
  if (!row.id) delete row.id;
  const { data, error } = await supabase
    .from("recipe_costs")
    .upsert(row, { onConflict: "recipe_id" })
    .select()
    .single();
  if (error) { console.error("saveRecipeCost error:", error); return null; }
  return data;
}

// ── Documentos / Manuales ───────────────────────────────────────

export async function getDocuments() {
  try {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getDocuments error:", err);
    return [];
  }
}

export async function saveDocument(doc) {
  const row = { ...doc };
  if (!row.id) delete row.id;
  const { data, error } = row.id
    ? await supabase.from("documents").update(row).eq("id", row.id).select().single()
    : await supabase.from("documents").insert(row).select().single();
  if (error) { console.error("saveDocument error:", error); return null; }
  return data;
}

export async function deleteDocument(id, fileUrl) {
  // Eliminar archivo del storage
  if (fileUrl) {
    try {
      const url = new URL(fileUrl);
      const parts = url.pathname.split("/recipe-images/");
      if (parts.length >= 2) {
        await supabase.storage.from("recipe-images").remove([parts[1]]);
      }
    } catch {}
  }
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) { console.error("deleteDocument error:", error); return false; }
  return true;
}

export async function uploadDocFile(file) {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `documents/${fileName}`;

  const { error } = await supabase.storage
    .from("recipe-images")
    .upload(filePath, file, { cacheControl: "86400", upsert: false });

  if (error) { console.error("uploadDocFile error:", error); return null; }

  const { data: urlData } = supabase.storage
    .from("recipe-images")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ── Proveedores ──────────────────────────────────────────────────

export async function getProveedores() {
  try {
    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .order("nombre", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getProveedores error:", err);
    return [];
  }
}

export async function saveProveedor(prov) {
  const row = { ...prov, updated_at: new Date().toISOString() };
  if (!row.id) delete row.id;
  const { data, error } = row.id
    ? await supabase.from("proveedores").update(row).eq("id", row.id).select().single()
    : await supabase.from("proveedores").insert(row).select().single();
  if (error) { console.error("saveProveedor error:", error); return null; }
  return data;
}

export async function deleteProveedor(id) {
  const { error } = await supabase.from("proveedores").delete().eq("id", id);
  if (error) { console.error("deleteProveedor error:", error); return false; }
  return true;
}

// ── Compras ───────────────────────────────────────────────────────

export async function getCompras() {
  try {
    const { data, error } = await supabase
      .from("compras")
      .select("*, proveedor:proveedores(id, nombre), items:compras_items(*, supply:supplies(id, name, unit))")
      .order("fecha_pedido", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getCompras error:", err);
    return [];
  }
}

export async function saveCompra(compra, items = []) {
  const now = new Date().toISOString();
  const row = { ...compra, updated_at: now };
  if (!row.id) delete row.id;

  // 1. Guardar cabecera
  const { data: saved, error } = row.id
    ? await supabase.from("compras").update(row).eq("id", row.id).select().single()
    : await supabase.from("compras").insert(row).select().single();
  if (error) { console.error("saveCompra error:", error); return null; }

  // 2. Guardar ítems (borrar los viejos y reinsertar)
  if (items.length > 0) {
    await supabase.from("compras_items").delete().eq("compra_id", saved.id);
    const rows = items.map(it => ({
      compra_id:         saved.id,
      supply_id:         it.supply_id,
      cantidad_pedida:   parseFloat(it.cantidad_pedida) || 0,
      cantidad_recibida: parseFloat(it.cantidad_recibida) || 0,
      cost_per_unit:     parseFloat(it.cost_per_unit) || 0,
      subtotal:          (parseFloat(it.cantidad_recibida) || 0) * (parseFloat(it.cost_per_unit) || 0),
      estado:            it.estado || "pendiente",
      notas:             it.notas || "",
    }));
    const { error: itemsErr } = await supabase.from("compras_items").insert(rows);
    if (itemsErr) console.error("saveCompra items error:", itemsErr);

    // 3. Actualizar total en cabecera
    const total = rows.reduce((s, r) => s + r.subtotal, 0);
    await supabase.from("compras").update({ total, updated_at: now }).eq("id", saved.id);
  }

  return saved;
}

export async function deleteCompra(id) {
  const { error } = await supabase.from("compras").delete().eq("id", id);
  if (error) { console.error("deleteCompra error:", error); return false; }
  return true;
}

// Recibir una compra: actualiza inventario y escribe kardex
export async function recibirCompra(compraId, itemsRecibidos, usuario = "") {
  const now = new Date().toISOString();
  const errors = [];

  for (const item of itemsRecibidos) {
    if (!item.cantidad_recibida || item.cantidad_recibida <= 0) continue;

    // a) Obtener stock actual
    const { data: inv } = await supabase
      .from("inventario")
      .select("id, stock_actual")
      .eq("supply_id", item.supply_id)
      .single();

    const stockAnterior = inv?.stock_actual || 0;
    const stockNuevo = stockAnterior + parseFloat(item.cantidad_recibida);

    // b) Upsert inventario
    const { error: invErr } = await supabase
      .from("inventario")
      .upsert(
        { supply_id: item.supply_id, stock_actual: stockNuevo, updated_at: now },
        { onConflict: "supply_id" }
      );
    if (invErr) { errors.push(invErr); continue; }

    // c) Escribir kardex
    await supabase.from("kardex").insert({
      supply_id:       item.supply_id,
      fecha:           now,
      tipo:            "compra",
      referencia_id:   compraId,
      referencia_tipo: "compra",
      cantidad:        parseFloat(item.cantidad_recibida),
      stock_anterior:  stockAnterior,
      stock_nuevo:     stockNuevo,
      costo_unitario:  parseFloat(item.cost_per_unit) || 0,
      costo_total:     parseFloat(item.cantidad_recibida) * (parseFloat(item.cost_per_unit) || 0),
      notas:           `Compra recibida`,
      usuario,
    });

    // d) Actualizar precio del insumo con el último costo
    if (item.cost_per_unit > 0) {
      await supabase.from("supplies")
        .update({ cost_per_unit: parseFloat(item.cost_per_unit), updated_at: now })
        .eq("id", item.supply_id);
    }

    // e) Actualizar ítem de compra
    await supabase.from("compras_items")
      .update({ cantidad_recibida: item.cantidad_recibida, estado: "recibido" })
      .eq("compra_id", compraId)
      .eq("supply_id", item.supply_id);
  }

  // f) Actualizar estado de la compra
  await supabase.from("compras")
    .update({ estado: "recibido", fecha_recepcion: now, updated_at: now })
    .eq("id", compraId);

  return errors.length === 0;
}

// ── Inventario ────────────────────────────────────────────────────

export async function getInventario() {
  try {
    const { data, error } = await supabase
      .from("inventario")
      .select("*, supply:supplies(id, name, unit, category, cost_per_unit)")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getInventario error:", err);
    return [];
  }
}

export async function saveInventarioItem(item) {
  const row = { ...item, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("inventario")
    .upsert(row, { onConflict: "supply_id" })
    .select()
    .single();
  if (error) { console.error("saveInventarioItem error:", error); return null; }
  return data;
}

// ── Kardex ────────────────────────────────────────────────────────

export async function getKardex(supplyId = null, limit = 200) {
  try {
    let q = supabase
      .from("kardex")
      .select("*, supply:supplies(id, name, unit)")
      .order("fecha", { ascending: false })
      .limit(limit);
    if (supplyId) q = q.eq("supply_id", supplyId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getKardex error:", err);
    return [];
  }
}

// ── Bajas ─────────────────────────────────────────────────────────

export async function getBajas() {
  try {
    const { data, error } = await supabase
      .from("bajas")
      .select("*, supply:supplies(id, name, unit)")
      .order("fecha", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("getBajas error:", err);
    return [];
  }
}

export async function saveBaja(baja, usuario = "") {
  const now = new Date().toISOString();
  const row = { ...baja };
  if (!row.id) delete row.id;

  // Guardar baja
  const { data: saved, error } = await supabase
    .from("bajas")
    .insert(row)
    .select()
    .single();
  if (error) { console.error("saveBaja error:", error); return null; }

  // Actualizar inventario
  const { data: inv } = await supabase
    .from("inventario")
    .select("id, stock_actual")
    .eq("supply_id", baja.supply_id)
    .single();

  const stockAnterior = inv?.stock_actual || 0;
  const stockNuevo = Math.max(0, stockAnterior - parseFloat(baja.cantidad));

  await supabase.from("inventario").upsert(
    { supply_id: baja.supply_id, stock_actual: stockNuevo, updated_at: now },
    { onConflict: "supply_id" }
  );

  // Kardex (salida negativa)
  await supabase.from("kardex").insert({
    supply_id:       baja.supply_id,
    fecha:           now,
    tipo:            "baja",
    referencia_id:   saved.id,
    referencia_tipo: "baja",
    cantidad:        -parseFloat(baja.cantidad),
    stock_anterior:  stockAnterior,
    stock_nuevo:     stockNuevo,
    costo_unitario:  baja.costo_unitario || 0,
    costo_total:     -(parseFloat(baja.cantidad) * (baja.costo_unitario || 0)),
    notas:           `Baja: ${baja.motivo}`,
    usuario,
  });

  return saved;
}

export async function deleteBaja(id) {
  const { error } = await supabase.from("bajas").delete().eq("id", id);
  if (error) { console.error("deleteBaja error:", error); return false; }
  return true;
}

// ── Helpers de mapeo ─────────────────────────────────────────────

function dbToRecipe(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    prepTime: row.prep_time || "",
    cookTime: row.cook_time || "",
    portions: row.portions || "",
    ingredients: row.ingredients || [],
    preparation: row.preparation || "",
    recommendations: row.recommendations || "",
    image: row.image_url || null,
    video: row.video || "",
    description: row.description || "",
    salesPitch: row.sales_pitch || "",
    published: row.published || false,
  };
}

function recipeToDb(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    prep_time: recipe.prepTime || "",
    cook_time: recipe.cookTime || "",
    portions: recipe.portions || "",
    ingredients: recipe.ingredients || [],
    preparation: recipe.preparation || "",
    recommendations: recipe.recommendations || "",
    image_url: recipe.image || null,
    video: recipe.video || "",
    description: recipe.description || "",
    sales_pitch: recipe.salesPitch || "",
    published: recipe.published || false,
  };
}
