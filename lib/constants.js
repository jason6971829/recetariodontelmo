export const CATEGORIES = [
  { id: "all",                label: "Todas las Recetas",    icon: "🍽️" },
  { id: "Adiciones",          label: "Adiciones",            icon: "➕" },
  { id: "Arepas",             label: "Arepas",               icon: "🫓" },
  { id: "Hamburguesas",       label: "Hamburguesas",         icon: "🍔" },
  { id: "Pizzas",             label: "Pizzas",               icon: "🍕" },
  { id: "Porciones",          label: "Porciones",            icon: "🥗" },
  { id: "Pastas y Lasagnas",  label: "Pastas & Lasagnas",    icon: "🍝" },
  { id: "Mazorcadas",         label: "Mazorcadas",           icon: "🌽" },
  { id: "Ensaladas",          label: "Ensaladas",            icon: "🥙" },
  { id: "Patacones",          label: "Patacones",            icon: "🍌" },
  { id: "Perros",             label: "Perros Calientes",     icon: "🌭" },
  { id: "Sandwiches",         label: "Sandwiches",           icon: "🥪" },
  { id: "Salchipapas",        label: "Salchipapas",          icon: "🍟" },
  { id: "Sodas Artesanales",  label: "Sodas Artesanales",    icon: "🥤" },
  { id: "Platos Fuertes",     label: "Platos Fuertes",       icon: "🍲" },
  { id: "Jugos y Bebidas",    label: "Jugos & Bebidas",      icon: "🍊" },
  { id: "Gaseosas y Cervezas",label: "Gaseosas & Cervezas",  icon: "🍺" },
  { id: "Vinos y Cocteles",   label: "Vinos & Cócteles",     icon: "🍷" },
  { id: "Calentado",          label: "Calentado",            icon: "♨️" },
  { id: "Postres y Helados",  label: "Postres & Helados",    icon: "🍨" },
  { id: "Entradas",           label: "Entradas",             icon: "🥗" },
  { id: "Menu Infantil",      label: "Menú Infantil",        icon: "👶" },
  { id: "Modificadores",      label: "Modificadores",        icon: "⚙️" },
];

export const INITIAL_USERS = [
  { id: 1, username: "admin",   password: "telmo2026",  role: "admin",    name: "Administrador" },
  { id: 2, username: "cocina1", password: "cocina2026", role: "cocinero", name: "Equipo Cocina" },
];

export const DOC_CATEGORIES = [
  { id: "identidad",  label: "Identidad de Marca", icon: "🎨" },
  { id: "servicio",   label: "Manuales de Servicio", icon: "📋" },
  { id: "higiene",    label: "Manuales de Higiene", icon: "🧼" },
  { id: "protocolo",  label: "Manuales de Protocolo", icon: "📜" },
  { id: "otro",       label: "Otros", icon: "📁" },
];

export const STORAGE_KEYS = { recipes: "dontelmo:recipes", users: "dontelmo:users" };
