const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
const vars = {};
env.split("\n").forEach((l) => { const [k, ...v] = l.split("="); if (k) vars[k.trim()] = v.join("=").trim(); });
const supabase = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const descriptions = [
  // ENTRADAS
  { match: "BOWL PAPAS AMERICANO", desc: "Porcion de papas a la francesa crujientes, banadas en salsa de queso cheddar, queso fundido y tocineta crocante." },
  { match: "BOWL PAPAS MEXICANO", desc: "Papas a la francesa doradas y crujientes, acompanadas de chili con carne artesanal, salsa de queso cheddar, queso fundido, sour cream y jalapenos, una combinacion intensa y reconfortante." },
  { match: "CHICHARRON MOZZARELLA", desc: "Chicharron crocante servido con totopos, papa criolla y guacamole artesanal con tocineta, ideal para compartir y disfrutar." },
  { match: "CEVICHE CHICHARRON", desc: "Chicharron en cama de encurtido de cebolla, pimenton y cilantro, acompanado de yuca al vapor." },
  { match: "CEVICHE DON TELMO", desc: "Chicharron picado servido con platano maduro, salsa especial y encurtido de cebolla y pimenton para un balance perfecto entre crocante y frescura." },
  { match: "DEDITOS MOZZARELLA", desc: "5 deditos de mozzarella caseros, doraditos y crujientes por fuera, con queso fundido." },
  { match: "ARITOS DE CEBOLLA", desc: "8 aros de cebolla crujientes, perfectamente apanados y dorados, acompanados de nuestra salsa de lena, listos para disfrutar." },
  // SOPAS
  { match: "SOPA NAPOLITANA", desc: "Sopa cremosa de tomate con maiz tierno, aguacate fresco, un toque de sour cream y crujientes tiras de tortilla." },
  { match: "SOPA DON TELMO", desc: "Sopa cremosa de tomate con pollo jugoso, champinones salteados, un toque de sour cream y tortilla crocante que le da el crunch perfecto." },
  // CALENTADOS
  { match: "CALENTADO FRIJOLES", desc: "Calentado de frijoles con carne desmechada, arroz, platano maduro, papa y huevo, un clasico lleno de sabor." },
  { match: "CALENTADO PASTA", desc: "Calentado casero de pasta salteada con carne desmechada y pollo jugoso, papa doradita, arroz y huevo." },
  // HAMBURGUESAS
  { match: "CLASICA", desc: "Pan 100% artesanal tipo brioche, carne de res, queso tipo mozzarella, tocineta y salsas." },
  { match: "CRISPY CHICKEN", desc: "Hamburguesa en pan brioche 100% artesanal, con pollo apanado hecho en casa, papa chip crocante, mix de lechuga y espinaca, tomate fresco, cebolla grille, queso tipo mozzarella, tocineta, huevo de codorniz y salsas." },
  { match: "ESPECIAL", desc: "Pan 100% artesanal tipo brioche, carne de res, tocineta, papa chip, mix de lechuga y espinaca, tomate, cebolla grille, queso tipo mozzarella, huevo de codorniz y salsas." },
  { match: "BACON CHEESE", desc: "Pan 100% artesanal tipo brioche, carne de res, espinaca, tocineta, tomate, cebolla morada, pepinillos, queso tipo cheddar y salsas." },
  { match: "COLOMBIANA", desc: "Pan 100% artesanal tipo brioche, carne de res, tocineta, mix de lechuga, espinaca, tomate, cebolla grille, queso tipo mozzarella, platano maduro, huevo frito y salsas." },
  { match: "BIRRIA", desc: "Pan 100% artesanal tipo brioche, carne de res desmechada de cadera y picana, guacamole, queso y tortilla de maiz, acompanada de caldo de birria." },
  // PERROS CALIENTES
  { match: "PERRO AMERICANO", desc: "Pan de perro 100% artesanal, con salchicha americana, cebolla grille, papa chip crocante, queso mozzarella fundido, tocineta crujiente, huevo de codorniz y una mezcla irresistible de salsas." },
  { match: "PERRO DON TELMO", desc: "Pan de perro 100% artesanal con salchicha americana, pollo desmechado, jamon y champinones, papa chip crocante, queso mozzarella fundido, tocineta crujiente, huevo de codorniz y salsas." },
  { match: "PERRO TEXANO", desc: "Pan de perro 100% artesanal, salchicha americana, chili con carne, salsa cheddar, jalapeno y tocineta." },
  { match: "PERRO HAWAIANO", desc: "Pan de perro 100% artesanal, salchicha americana, trozos de pina confitada, papa chip, queso tipo mozzarella, tocineta y salsas." },
  { match: "CHORIPERRO", desc: "Pan de perro 100% artesanal, chorizo, cebolla grille, papa chip, queso tipo mozzarella, tocineta, huevo de codorniz y salsas." },
  { match: "PERRO GAUCHO", desc: "La mezcla perfecta entre la intensidad del chorizo y la frescura de los cherrys asados. El contraste del chimichurri con la cremosidad del queso crema." },
  // SALCHIPAPAS
  { match: "SALCHIPAPA", desc: "Papas a la francesa doradas y crujientes con salchicha, queso fundido y salsas." },
  // MAZORCADAS
  { match: "MAZORCADA CARNE", desc: "Maiz desgranado, trozos de carne de res, papa chip, queso tipo mozzarella y salsas." },
  { match: "MAZORCADA CERDO", desc: "Maiz desgranado, trozos de carne de cerdo, tocineta, huevo de codorniz, papa chip, queso tipo mozzarella y salsas." },
  { match: "MAZORCADA POLLO", desc: "Maiz desgranado, trozos de pollo, papa chip, queso tipo mozzarella y salsas." },
  { match: "MAZORCADA TRES CARNES", desc: "Maiz desgranado, trozos de carne de res, cerdo y pollo, papa chip, queso tipo mozzarella y salsas." },
  { match: "MAZORCADA MIXTA", desc: "Maiz desgranado, trozos de carne de res y pollo, papa chip, queso tipo mozzarella y salsas." },
  { match: "MAZORCADA VEGETARIANA", desc: "Maiz desgranado, tomate Cherry, cebolla morada, champinones, salsas, queso tipo mozzarella." },
  // AREPAS
  { match: "AREPA", desc: "Arepa rellena artesanal, dorada y crujiente por fuera, suave por dentro." },
  // PATACONES
  { match: "PATACON POLLO", desc: "Patacon maduro, pollo desmechado, mix de lechuga y espinaca, hogao y queso tipo mozzarella gratinado." },
  { match: "PATACON CARNE", desc: "Patacon maduro dorado, cubierto con carne desmechada jugosa, mix fresco de lechuga y espinaca, hogao criollo y queso mozzarella gratinado." },
  { match: "PATACON MIXTO", desc: "Patacon maduro dorado cargado con pollo y carne desmechados, jugosos y bien sazonados, sobre un mix fresco de lechuga y espinaca, banado en hogao criollo y coronado con queso mozzarella gratinado." },
  { match: "PATACON CRIOLLA", desc: "Patacon maduro dorado y crujiente, cargado con carne desmechada jugosa, chorizo artesanal, hogao criollo, tocineta crocante y maiz tierno, coronado con queso mozzarella gratinado." },
  // PIZZAS
  { match: "HAWAIANA", desc: "Salsa base de la casa, jamon ahumado, trozos de pina confitados y queso tipo mozzarella." },
  { match: "BBQ", desc: "Salsa base de la casa, jamon ahumado, carne molida, tomate picado en salsa roja picante y queso tipo mozzarella." },
  { match: "PEPPERONI", desc: "Salsa base de la casa, pepperoni y queso tipo mozzarella." },
  { match: "CARNES", desc: "Salsa base de la casa, carne molida, jamon, tocineta, pepperoni y queso tipo mozzarella." },
  { match: "MEXICANA", desc: "Salsa base de la casa, carne molida, jalapenos, pimenton, cebolla y queso tipo mozzarella." },
  { match: "POLLO CON CHAMPI", desc: "Salsa base de la casa, finas laminas de champinones, pollo desmechado y queso mozzarella." },
  { match: "CRIOLLA", desc: "Salsa base de la casa, carne molida, chorizo, cebolla, hogao criollo y queso tipo mozzarella." },
  // PASTAS
  { match: "BOLOGNESA", desc: "Fettuccine fresco artesanal, 100% semola, banado en salsa bolognesa de coccion lenta, terminado con queso parmesano rallado y acompanado de pan." },
  { match: "CARBONARA", desc: "Fettuccine fresco artesanal en cremosa salsa blanca con tocineta crocante, queso parmesano y un toque de pimienta." },
  { match: "ALFREDO", desc: "Fettuccine fresco artesanal en salsa cremosa de queso con pollo grille y champinones salteados." },
  // LASAGNAS
  { match: "LASAGNA", desc: "Capas de pasta artesanal con salsa bolognesa, bechamel cremosa y queso gratinado." },
  // PARRILLA
  { match: "COSTILLA BABY", desc: "Corte tierno de costilla baby de cerdo (500g), horneada por 10 horas para que quede jugosa y llena de sabor, banada en salsa BBQ, para disfrutar con una ensalada y dos acompanamientos." },
  { match: "AL CABALLO", desc: "Churrasco o pechuga cubiertos con cebolla grille, tomate asado, hogao y huevo frito, mas ensalada y dos acompanamientos." },
  { match: "CHAMPI", desc: "Pechuga en salsa de champinones, mas ensalada y dos acompanamientos." },
  { match: "LENGUA", desc: "Platillo de lengua de res guisado, acompanado de yuca, papa, mazorca, arroz y aguacate." },
  { match: "SOBREBARRIGA", desc: "Sobrebarriga de res guisada, acompanada de yuca, papa, mazorca, arroz y aguacate." },
  { match: "CHURRASCO", desc: "Corte de churrasco a la parrilla, acompanado de ensalada y dos acompanamientos de tu eleccion." },
  { match: "PECHUGA", desc: "Pechuga a la parrilla, acompanada de ensalada y dos acompanamientos de tu eleccion." },
  // SANDWICHES
  { match: "SANDWICH GAUCHO", desc: "Base de pan, salsa, chorizo, pico de gallo, chimichurri, queso tipo mozzarella y papa a la francesa." },
  { match: "SANDWICH ITALIANO", desc: "Base de pan, salsa ranch, jamon, queso, tocineta, papa a la francesa." },
  { match: "SANDWICH POLLO", desc: "Base de pan, tomate, mix de lechuga y espinaca, pollo desmechado, salsa ranch, jamon, queso y papa a la francesa." },
  // ENSALADAS
  { match: "ENSALADA CESAR", desc: "Mix de lechugas frescas, crutones artesanales, queso parmesano, aderezo cesar y pechuga grille." },
  { match: "ENSALADA", desc: "Ensalada fresca con ingredientes de la casa." },
];

function normalize(str) {
  return str.toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ").trim();
}

(async () => {
  const { data: recipes } = await supabase.from("recipes").select("id, name, description");
  let updated = 0;

  for (const d of descriptions) {
    const matchWords = normalize(d.match).split(" ");
    const matching = recipes.filter((r) => {
      const rName = normalize(r.name);
      return matchWords.every((w) => rName.includes(w));
    });

    for (const r of matching) {
      if (!r.description || r.description.trim() === "") {
        const { error } = await supabase.from("recipes").update({ description: d.desc }).eq("id", r.id);
        if (!error) {
          console.log("OK", r.name, "->", d.desc.substring(0, 50) + "...");
          updated++;
        } else {
          console.log("ERR", r.name, error.message);
        }
      }
    }
  }

  console.log("\nTotal actualizadas:", updated);
})();
