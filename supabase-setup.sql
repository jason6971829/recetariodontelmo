-- ═══════════════════════════════════════════════════════════════════
-- SQL para configurar Supabase - Recetario Don Telmo
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- 1. Tabla de recetas
CREATE TABLE IF NOT EXISTS recipes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Adiciones',
  prep_time TEXT DEFAULT '',
  cook_time TEXT DEFAULT '',
  portions TEXT DEFAULT '',
  ingredients JSONB DEFAULT '[]'::jsonb,
  preparation TEXT DEFAULT '',
  recommendations TEXT DEFAULT '',
  image_url TEXT,
  video TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cocinero'
);

-- 3. Insertar usuarios iniciales
INSERT INTO users (id, username, password, name, role) VALUES
  (1, 'admin', 'telmo2026', 'Administrador', 'admin'),
  (2, 'cocina1', 'cocina2026', 'Equipo Cocina', 'cocinero')
ON CONFLICT (username) DO NOTHING;

-- 4. Habilitar RLS (Row Level Security) pero permitir acceso público
-- (la app maneja autenticación internamente)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Políticas que permiten lectura y escritura con la anon key
CREATE POLICY "Acceso público lectura recipes" ON recipes FOR SELECT USING (true);
CREATE POLICY "Acceso público escritura recipes" ON recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Acceso público update recipes" ON recipes FOR UPDATE USING (true);
CREATE POLICY "Acceso público delete recipes" ON recipes FOR DELETE USING (true);

CREATE POLICY "Acceso público lectura users" ON users FOR SELECT USING (true);
CREATE POLICY "Acceso público escritura users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Acceso público update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Acceso público delete users" ON users FOR DELETE USING (true);

-- 5. Crear bucket de Storage para imágenes
-- (Esto se hace desde el Dashboard: Storage → New Bucket → "recipe-images" → Public)
