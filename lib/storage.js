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
