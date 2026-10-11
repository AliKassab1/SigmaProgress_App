/* ==========================================================================
   SIGMA PROGRESS — data/foods.js
   --------------------------------------------------------------------------
   Die Lebensmittel-Datenbank fuer das Essens-Tracking im Yazio-Stil.

   Alle Werte gelten je 100 g (bzw. 100 ml): `kcal`, `protein`, `carbs` und
   `fat`. `grams` ist die Standard-Portion in Gramm, die dem Nutzer als
   Ausgangspunkt angeboten wird, wenn er eine Menge waehlt.

   `cat` ist eine der Kategorien:
     fruehstueck | protein | beilage | gemuese | obst | snack | getraenk

   Die Liste ist eine kuratierte Auswahl, kein Kalorien-Universum — aber
   gross genug, dass sich die typischen Mahlzeiten damit abbilden lassen.
   ========================================================================== */

export const FOOD_CATEGORIES = [
  { id: "alle", label: "Alle" },
  { id: "fruehstueck", label: "Frühstück" },
  { id: "protein", label: "Protein" },
  { id: "beilage", label: "Beilagen" },
  { id: "gemuese", label: "Gemüse" },
  { id: "obst", label: "Obst" },
  { id: "snack", label: "Snacks" },
  { id: "getraenk", label: "Getränke" },
];

/** `grams` zählt zusätzlich — die eigentlichen Werte sind je 100 g. */
export const FOODS = [
  /* Frühstück */
  { id: "haferflocken", name: "Haferflocken", cat: "fruehstueck", kcal: 367, protein: 13.5, carbs: 58, fat: 7, grams: 50, portion: "1 Portion (50 g)" },
  { id: "muesli", name: "Müsli", cat: "fruehstueck", kcal: 360, protein: 9, carbs: 62, fat: 6.5, grams: 60, portion: "1 Portion (60 g)" },
  { id: "vollkornbrot", name: "Vollkornbrot", cat: "fruehstueck", kcal: 247, protein: 8, carbs: 41, fat: 3.2, grams: 50, portion: "1 Scheibe (50 g)" },
  { id: "broetchen", name: "Brötchen", cat: "fruehstueck", kcal: 272, protein: 9, carbs: 52, fat: 2.5, grams: 70, portion: "1 Stück (70 g)" },
  { id: "magerquark", name: "Magerquark", cat: "fruehstueck", kcal: 67, protein: 12, carbs: 4, fat: 0.2, grams: 250, portion: "1 Becher (250 g)" },
  { id: "skyr", name: "Skyr", cat: "fruehstueck", kcal: 62, protein: 11, carbs: 3.5, fat: 0.2, grams: 200, portion: "1 Becher (200 g)" },
  { id: "naturjoghurt", name: "Naturjoghurt", cat: "fruehstueck", kcal: 65, protein: 3.8, carbs: 4.5, fat: 3.5, grams: 150, portion: "1 Becher (150 g)" },
  { id: "birchermuesli", name: "Birchermüsli", cat: "fruehstueck", kcal: 110, protein: 4, carbs: 18, fat: 2.5, grams: 200, portion: "1 Portion (200 g)" },

  /* Protein */
  { id: "haehnchen", name: "Hähnchenbrust", cat: "protein", kcal: 165, protein: 31, carbs: 0, fat: 3.6, grams: 150, portion: "1 Portion (150 g)" },
  { id: "putenbrust", name: "Putenbrust", cat: "protein", kcal: 109, protein: 24, carbs: 0, fat: 1.4, grams: 150, portion: "1 Portion (150 g)" },
  { id: "rind", name: "Rinderfilet", cat: "protein", kcal: 130, protein: 23, carbs: 0, fat: 3.7, grams: 150, portion: "1 Portion (150 g)" },
  { id: "rinderhack", name: "Rinderhack", cat: "protein", kcal: 209, protein: 20, carbs: 0, fat: 14, grams: 120, portion: "1 Portion (120 g)" },
  { id: "lachs", name: "Lachs", cat: "protein", kcal: 208, protein: 20, carbs: 0, fat: 13, grams: 150, portion: "1 Portion (150 g)" },
  { id: "thunfisch", name: "Thunfisch (Dose)", cat: "protein", kcal: 116, protein: 26, carbs: 0, fat: 0.8, grams: 150, portion: "1 Dose (150 g)" },
  { id: "tofu", name: "Tofu", cat: "protein", kcal: 145, protein: 15, carbs: 3, fat: 8.5, grams: 150, portion: "1 Portion (150 g)" },
  { id: "eier", name: "Eier", cat: "protein", kcal: 143, protein: 12.5, carbs: 0.6, fat: 10, grams: 120, portion: "2 Stück (120 g)" },
  { id: "garnelen", name: "Garnelen", cat: "protein", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, grams: 100, portion: "1 Portion (100 g)" },
  { id: "kaese", name: "Käse (Gouda)", cat: "protein", kcal: 356, protein: 25, carbs: 0.6, fat: 28, grams: 30, portion: "1 Portion (30 g)" },
  { id: "mozzarella", name: "Mozzarella", cat: "protein", kcal: 253, protein: 19, carbs: 1, fat: 19, grams: 50, portion: "1 Portion (50 g)" },
  { id: "whey", name: "Proteinshake (Whey)", cat: "protein", kcal: 380, protein: 78, carbs: 6, fat: 6, grams: 30, portion: "1 Portion (30 g)" },

  /* Beilagen */
  { id: "reis", name: "Reis, gekocht", cat: "beilage", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, grams: 150, portion: "1 Portion (150 g)" },
  { id: "nudeln", name: "Vollkornnudeln", cat: "beilage", kcal: 150, protein: 5.8, carbs: 28, fat: 1.8, grams: 150, portion: "1 Portion (150 g)" },
  { id: "kartoffeln", name: "Kartoffeln", cat: "beilage", kcal: 77, protein: 2, carbs: 17, fat: 0.1, grams: 200, portion: "1 Portion (200 g)" },
  { id: "suesskartoffel", name: "Süßkartoffel", cat: "beilage", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, grams: 200, portion: "1 Portion (200 g)" },
  { id: "quinoa", name: "Quinoa, gekocht", cat: "beilage", kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, grams: 150, portion: "1 Portion (150 g)" },
  { id: "couscous", name: "Couscous", cat: "beilage", kcal: 112, protein: 3.8, carbs: 23, fat: 0.2, grams: 150, portion: "1 Portion (150 g)" },
  { id: "bohnen", name: "Kidneybohnen", cat: "beilage", kcal: 127, protein: 8.7, carbs: 23, fat: 0.5, grams: 120, portion: "1 Portion (120 g)" },

  /* Gemüse */
  { id: "brokkoli", name: "Brokkoli", cat: "gemuese", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, grams: 150, portion: "1 Portion (150 g)" },
  { id: "paprika", name: "Paprika", cat: "gemuese", kcal: 31, protein: 1, carbs: 6, fat: 0.3, grams: 100, portion: "1 Stück (100 g)" },
  { id: "tomate", name: "Tomate", cat: "gemuese", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, grams: 100, portion: "1 Stück (100 g)" },
  { id: "gurke", name: "Gurke", cat: "gemuese", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, grams: 100, portion: "1 Portion (100 g)" },
  { id: "karotte", name: "Karotte", cat: "gemuese", kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, grams: 100, portion: "1 Stück (100 g)" },
  { id: "spinat", name: "Spinat", cat: "gemuese", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, grams: 100, portion: "1 Portion (100 g)" },
  { id: "zucchini", name: "Zucchini", cat: "gemuese", kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, grams: 100, portion: "1 Portion (100 g)" },
  { id: "gemuese", name: "Gemüsepfanne", cat: "gemuese", kcal: 55, protein: 2.8, carbs: 8, fat: 1.5, grams: 200, portion: "1 Portion (200 g)" },
  { id: "salat", name: "Blattsalat", cat: "gemuese", kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, grams: 100, portion: "1 Portion (100 g)" },
  { id: "champignons", name: "Champignons", cat: "gemuese", kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, grams: 100, portion: "1 Portion (100 g)" },

  /* Obst */
  { id: "banane", name: "Banane", cat: "obst", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, grams: 120, portion: "1 Stück (120 g)" },
  { id: "apfel", name: "Apfel", cat: "obst", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, grams: 150, portion: "1 Stück (150 g)" },
  { id: "beeren", name: "Beeren, gemischt", cat: "obst", kcal: 55, protein: 1, carbs: 12, fat: 0.4, grams: 100, portion: "1 Portion (100 g)" },
  { id: "erdbeeren", name: "Erdbeeren", cat: "obst", kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, grams: 100, portion: "1 Portion (100 g)" },
  { id: "heidelbeeren", name: "Heidelbeeren", cat: "obst", kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, grams: 100, portion: "1 Portion (100 g)" },
  { id: "orange", name: "Orange", cat: "obst", kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, grams: 150, portion: "1 Stück (150 g)" },
  { id: "kiwi", name: "Kiwi", cat: "obst", kcal: 61, protein: 1.1, carbs: 15, fat: 0.5, grams: 80, portion: "1 Stück (80 g)" },
  { id: "trauben", name: "Trauben", cat: "obst", kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, grams: 100, portion: "1 Portion (100 g)" },
  { id: "mango", name: "Mango", cat: "obst", kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, grams: 100, portion: "1 Portion (100 g)" },

  /* Snacks & Fette */
  { id: "mandeln", name: "Mandeln", cat: "snack", kcal: 579, protein: 21, carbs: 22, fat: 50, grams: 30, portion: "1 Portion (30 g)" },
  { id: "walnuesse", name: "Walnüsse", cat: "snack", kcal: 654, protein: 15, carbs: 14, fat: 65, grams: 30, portion: "1 Portion (30 g)" },
  { id: "proteinriegel", name: "Proteinriegel", cat: "snack", kcal: 380, protein: 34, carbs: 38, fat: 9, grams: 60, portion: "1 Riegel (60 g)" },
  { id: "avocado", name: "Avocado", cat: "snack", kcal: 160, protein: 2, carbs: 8.5, fat: 15, grams: 50, portion: "½ Stück (50 g)" },
  { id: "hummus", name: "Hummus", cat: "snack", kcal: 166, protein: 7.9, carbs: 14, fat: 9.6, grams: 50, portion: "1 Portion (50 g)" },
  { id: "erdnussbutter", name: "Erdnussbutter", cat: "snack", kcal: 588, protein: 25, carbs: 20, fat: 50, grams: 20, portion: "1 Portion (20 g)" },
  { id: "schoko", name: "Schokolade 85 %", cat: "snack", kcal: 598, protein: 7.9, carbs: 46, fat: 43, grams: 20, portion: "1 Riegel (20 g)" },
  { id: "griess", name: "Grießbrei", cat: "snack", kcal: 90, protein: 3.4, carbs: 14, fat: 2.3, grams: 200, portion: "1 Portion (200 g)" },

  /* Getränke */
  { id: "milch35", name: "Milch (3,5 %)", cat: "getraenk", kcal: 64, protein: 3.3, carbs: 4.7, fat: 3.5, grams: 200, portion: "1 Glas (200 ml)" },
  { id: "milch15", name: "Milch (1,5 %)", cat: "getraenk", kcal: 47, protein: 3.4, carbs: 4.8, fat: 1.5, grams: 200, portion: "1 Glas (200 ml)" },
  { id: "orangesaft", name: "Orangensaft", cat: "getraenk", kcal: 45, protein: 0.7, carbs: 10.4, fat: 0.2, grams: 200, portion: "1 Glas (200 ml)" },
  { id: "apfelsaft", name: "Apfelsaft", cat: "getraenk", kcal: 46, protein: 0.1, carbs: 11, fat: 0.1, grams: 200, portion: "1 Glas (200 ml)" },
  { id: "cappuccino", name: "Cappuccino", cat: "getraenk", kcal: 27, protein: 1.5, carbs: 2.2, fat: 1.5, grams: 200, portion: "1 Tasse (200 ml)" },
  { id: "cola", name: "Cola", cat: "getraenk", kcal: 42, protein: 0, carbs: 10.6, fat: 0, grams: 330, portion: "1 Dose (330 ml)" },
];

/** Werte einer Portion (Standardmenge) aus den 100-g-Werten. */
export function foodPortion(food, grams = food.grams) {
  const factor = grams / 100;
  return {
    grams,
    kcal: Math.round(food.kcal * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
}

/** Lebensmittel nach ID nachschlagen. */
export function foodById(id) {
  return FOODS.find((food) => food.id === id) || null;
}