/* ==========================================================================
   SIGMA PROGRESS — data/seed.js
   --------------------------------------------------------------------------
   Demodaten. Sie entstehen aus einem Profil, damit die App nach dem
   Onboarding mit einem stimmigen Stand startet: Gewichtsverlauf,
   Trainingstagebuch, Mahlzeiten, Wasser und Fotos passen dann zu den
   Angaben, die der Nutzer gemacht hat.

   Zwei Regeln:
     1. Alles ist berechnet, nichts zufaellig. Ein Reset ergibt wieder
        exakt denselben Stand, damit Screenshots und Tests vergleichbar
        bleiben. Dazu ein fester Zufallsgenerator mit Startwert.
     2. Die Werte sind realistisch, aber erfunden. Sie stehen fuer eine
        erfundene Nutzerin, nicht fuer eine echte Person.

   Zeitraum: 12 Wochen.
   ========================================================================== */

import { addDays, dayKey, parseDay, weekStart } from "../core/format.js";
import { TRAINING_KINDS } from "../core/stats.js";
import { FOODS } from "./foods.js";
import { placeholderPhoto } from "./photos.js";

const SEED_BASE = 20260101;
const HISTORY_DAYS = 84;

/** mulberry32 — kleiner, schneller, deterministischer Zufallsgenerator. */
function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Jeder Baustein zieht aus seinem eigenen Generator, nicht aus einem
 * gemeinsamen. Sonst aendert sich das Ergebnis, nur weil ein anderer
 * Baustein vorher lief — und die Demodaten waeren beim zweiten Aufruf
 * nicht mehr gleich.
 */
const streamFor = (name) => makeRandom(SEED_BASE ^ hash(name));

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/* --------------------------------------------------------------------------
   Bausteine
   -------------------------------------------------------------------------- */

const CHAT_SEED = [
  {
    role: "coach",
    text: "Guten Morgen! Schön, dass du wieder da bist. Dein Gewicht geht in die richtige Richtung. Gleich ist Training bei Max — sag mir danach kurz, wie es gelaufen ist.",
    daysAgo: 3,
    hour: 8,
  },
  {
    role: "me",
    text: "War super: 45 Minuten Krafttraining mit dem Trainer, Fokus Beine und Rücken.",
    daysAgo: 3,
    hour: 18,
  },
  {
    role: "coach",
    text: "Stark. Ich habe es als Einheit eingetragen — damit zählt es für deinen Wochenverlauf. Wichtig jetzt: genug Protein. Hast du dein Essen erfasst?",
    daysAgo: 3,
    hour: 18,
  },
  {
    role: "me",
    text: "Eine Frage: Ist es schlimm, wenn ich zwischendurch eine Woche aussetze?",
    daysAgo: 1,
    hour: 19,
  },
  {
    role: "coach",
    text: "Überhaupt nicht. Eine Woche Pause kostet dich nichts — du baust keine Muskulatur ab, sondern gibst dem Körper Zeit. Wichtig ist nur, dass du danach wieder einsteigst.",
    daysAgo: 1,
    hour: 19,
  },
];

/* --------------------------------------------------------------------------
   Gewichtsverlauf: 12 Wochen, sanft fallend, mit realistischem Rauschen
   -------------------------------------------------------------------------- */

function buildWeights({ start, current }) {
  const rand = streamFor("weights");
  const entries = [];
  const days = HISTORY_DAYS;

  for (let i = 0; i <= days; i++) {
    const date = addDays(dayKey(), i - days);
    const progress = i / days;
    /* linearer Trend minus leichte Taigeschwankung */
    const trend = start + (current - start) * progress;
    const wave = Math.sin(i / 5.2) * 0.24 + Math.sin(i / 13) * 0.12;
    const noise = (rand() - 0.5) * 0.28;

    /* Waage wochentlich statt taeglich: etwa 4 Eintraege pro Woche */
    const isWeighIn = i % 2 === 0 || rand() > 0.72;
    if (!isWeighIn) continue;

    entries.push({
      id: `w-${date}`,
      date,
      kg: round1(trend + wave + noise),
    });
  }

  return entries;
}

/* --------------------------------------------------------------------------
   Trainingstagebuch: 12 Wochen, ca. 3 Einheiten pro Woche
   -------------------------------------------------------------------------- */

/**
 * Trainingstagebuch: 12 Wochen, ca. 3 Einheiten pro Woche.
 *
 * Das Training laeuft vor Ort mit dem Trainer — jeder Eintrag ist deshalb
 * eine einfache Zeile (Art, Minuten, Intensitaet, Begleitung), kein
 * Uebungs-Protokoll.
 */
function buildHistory({ minutes } = {}) {
  const rand = streamFor("history");
  const history = [];
  const thisMonday = weekStart();
  const weeks = Math.round(HISTORY_DAYS / 7);
  const baseMinutes = Number(minutes) || 45;
  const kinds = TRAINING_KINDS.map((item) => item.id);

  /* Der Start liegt vor dem Onboarding, damit die Historie fuell ist. */
  for (let week = weeks - 1; week >= 0; week--) {
    const monday = addDays(thisMonday, -7 * week);
    /* Montag, Mittwoch, Samstag — mit gelegentlichem Ausfall */
    const slots = [0, 2, 5];

    slots.forEach((offset) => {
      const date = addDays(monday, offset);
      if (date > dayKey()) return; /* noch nicht passiert */
      if (rand() > 0.86) return; /* ~14 % Ausfall, das ist realistisch */

      const kind = kinds[Math.floor(rand() * kinds.length)];
      /* Einheiten mit Trainer dauern laenger als die alten App-Workouts. */
      const sessionMinutes =
        Math.max(30, Math.round((baseMinutes + (rand() * 30 - 10)) / 5) * 5);
      const intensity = rand() > 0.66 ? "hoch" : rand() > 0.33 ? "mittel" : "leicht";
      const withCoach = rand() > 0.28;
      const kindLabel = TRAINING_KINDS.find((item) => item.id === kind).label;

      history.push({
        id: `h-${date}-${kind}`,
        date,
        kind,
        name: kindLabel,
        minutes: sessionMinutes,
        intensity,
        withCoach,
        note: "",
        completedAt: `${date}T18:${String(10 + Math.floor(rand() * 40)).padStart(2, "0")}:00`,
      });
    });
  }

  return history.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* --------------------------------------------------------------------------
   Ernaehrung: die letzten 7 Tage
   -------------------------------------------------------------------------- */

/* Feste, realistische Kombinationen je Mahlzeit. `mult` multipliziert die
   Standardportion des Lebensmittels — so entstehen pro Mahlzeit 1–3 Zeilen. */
const MEAL_FOODS = {
  "Frühstück": [
    { id: "haferflocken", mult: 1 },
    { id: "magerquark", mult: 0.6 },
    { id: "banane", mult: 1 },
    { id: "skyr", mult: 1 },
    { id: "naturjoghurt", mult: 0.9 },
    { id: "vollkornbrot", mult: 1 },
    { id: "beeren", mult: 0.9 },
  ],
  "Mittagessen": [
    { id: "haehnchen", mult: 1 },
    { id: "reis", mult: 1 },
    { id: "rind", mult: 1 },
    { id: "kartoffeln", mult: 1 },
    { id: "putenbrust", mult: 1 },
    { id: "gemuese", mult: 1 },
    { id: "quinoa", mult: 1 },
  ],
  "Snack": [
    { id: "mandeln", mult: 1 },
    { id: "proteinriegel", mult: 1 },
    { id: "apfel", mult: 1 },
    { id: "beeren", mult: 1 },
    { id: "hummus", mult: 1 },
    { id: "banane", mult: 1 },
  ],
  "Abendessen": [
    { id: "thunfisch", mult: 1 },
    { id: "eier", mult: 1 },
    { id: "nudeln", mult: 1 },
    { id: "salat", mult: 1 },
    { id: "tofu", mult: 1 },
    { id: "brokkoli", mult: 1 },
    { id: "kaese", mult: 1.2 },
    { id: "milch15", mult: 1 },
  ],
};

function buildNutrition({ kcalPerDay = 1830 } = {}) {
  const rand = streamFor("nutrition");
  const entries = [];
  const meals = Object.keys(MEAL_FOODS);

  /* Jede Mahlzeit waehlt eine Hauptkomponente und gelegentlich eine zweite.
     Die Menge wird zusammengerechnet und am Ende des Tages auf das Ziel
     skaliert — so bleibt der Kalorienstand des Profils glaubhaft. */
  for (let d = 6; d >= 0; d--) {
    const date = addDays(dayKey(), -d);
    const dayEntries = [];

    meals.forEach((meal, mealIndex) => {
      const pool = MEAL_FOODS[meal];
      const count = d === 0 && mealIndex > 0 ? (rand() > 0.5 ? 1 : 0) : mealIndex === 0 && d === 0 ? 1 : 1;
      const picks = [pool[Math.floor(rand() * pool.length)]];
      if (count > 1 && rand() > 0.45) {
        picks.push(pool[Math.floor(rand() * pool.length)]);
      }

      picks.forEach((pick, index) => {
        const food = FOODS.find((item) => item.id === pick.id);
        if (!food) return;
        const swing = 0.8 + rand() * 0.4;
        const grams = Math.round(food.grams * pick.mult * swing);
        const factor = grams / 100;
        dayEntries.push({
          id: `m-${date}-${mealIndex}-${index}`,
          date,
          meal,
          foodId: food.id,
          name: food.name,
          portion: `${grams} g`,
          grams,
          kcal: Math.round(food.kcal * factor),
          protein: Math.round(food.protein * factor * 10) / 10,
          carbs: Math.round(food.carbs * factor * 10) / 10,
          fat: Math.round(food.fat * factor * 10) / 10,
        });
      });
    });

    /* Heute ist noch nicht fertig — drei Mahlzeiten statt vier. */
    if (d === 0) {
      const todays = dayEntries.filter((entry) => entry.meal !== "Abendessen");
      dayEntries.length = 0;
      dayEntries.push(...todays);
    }

    const dayKcal = dayEntries.reduce((sum, entry) => sum + entry.kcal, 0);
    const target = kcalPerDay * (d === 0 ? 0.7 : 1);
    const factor = Math.max(0.72, Math.min(1.35, target / Math.max(1, dayKcal)));

    dayEntries.forEach((entry) => {
      entry.kcal = Math.round(entry.kcal * factor);
      entry.protein = Math.round(entry.protein * factor * 10) / 10;
      entry.carbs = Math.round(entry.carbs * factor * 10) / 10;
      entry.fat = Math.round(entry.fat * factor * 10) / 10;
      entry.grams = Math.round(entry.grams * factor);
    });

    entries.push(...dayEntries);
  }

  return entries;
}

/* --------------------------------------------------------------------------
   Wasser: 1,0–1,75 l pro Tag
   -------------------------------------------------------------------------- */

function buildWater() {
  const rand = streamFor("water");
  const water = {};

  for (let d = 6; d >= 0; d--) {
    const date = addDays(dayKey(), -d);
    const glasses = d === 0 ? 5 : 4 + Math.floor(rand() * 4);
    water[date] = glasses * 250;
  }

  return water;
}

/** Favoriten, mit denen die Suche startet — die typischen Basics. */
function buildFavorites() {
  return ["haferflocken", "magerquark", "haehnchen", "reis", "banane"];
}

/* --------------------------------------------------------------------------
   Schritte: letzte 14 Tage
   -------------------------------------------------------------------------- */

/**
 * Schrittzahlen der letzten 14 Tage.
 *
 * `parseDay` statt `new Date(key)`: letzteres liest die ISO-Zeichenfolge als
 * UTC, wodurch in Mitteleuropa der Vortag des Sonntags als Samstag
 * ankommt — am Wochenende fehlt dann genau eine Zahl.
 */
function buildSteps(stepsPerDay = 8000) {
  const rand = streamFor("steps");
  const entries = [];

  for (let d = 13; d >= 0; d--) {
    const date = addDays(dayKey(), -d);
    const weekend = [0, 6].includes(parseDay(date).getDay());
    /* Am Wochenende wird mehr gelaufen, unter der Woche mehr marschiert —
       beides nur leicht, weil die meisten nicht bei jedem Wetter rausgehen. */
    const bias = weekend ? 0.82 : 0.94;
    const spread = stepsPerDay * 0.45;

    entries.push({
      id: `s-${date}`,
      date,
      count: Math.round(stepsPerDay * bias + (rand() - 0.35) * spread),
    });
  }

  return entries;
}

/* --------------------------------------------------------------------------
   Chat und Check-ins
   -------------------------------------------------------------------------- */

function buildChat() {
  return CHAT_SEED.map((item, index) => {
    const date = addDays(dayKey(), -item.daysAgo);
    return {
      id: `c-${index}`,
      role: item.role,
      text: item.text,
      at: `${date}T${String(item.hour).padStart(2, "0")}:24:00`,
    };
  });
}

function buildCheckins() {
  return [
    {
      id: "ci-done-1",
      date: addDays(dayKey(), -21),
      status: "erledigt",
      mood: 4,
      note: "Gute Woche, das Training im Büro hat geholfen.",
      answers: { schlaf: 7, energie: 4, schmerz: 2 },
      answeredAt: `${addDays(dayKey(), -21)}T19:10:00`,
    },
    {
      id: "ci-next",
      date: addDays(dayKey(), 3),
      status: "offen",
      mood: null,
      note: "",
      answers: {},
    },
  ];
}

/* --------------------------------------------------------------------------
   Das Demoprofil und alles, was daraus folgt
   -------------------------------------------------------------------------- */

/** Die fiktive Nutzerin. Sie ist der Grund, warum es Demodaten gibt. */
export const DEMO_PROFILE = {
  name: "Lena Müller",
  age: 34,
  height: 168,
  weight: 80.1,
  startWeight: 82.4,
  goalWeight: 75,
  goal: "abnehmen",
  level: "einsteiger",
  timePerDay: 20,
  equipment: ["kurzhantel", "matte", "gummiband", "stuhl"],
};

/** Wochen- und Tagesziele aus dem Profil. */
export function goalsFor(profile) {
  const weight = Number(profile.weight) || 75;
  const goal = profile.goal || "fit";
  const minutesPerDay = Number(profile.timePerDay) || 20;

  /* 32 kcal je kg, plus 300 wenn zunehmen. Protein: 1,8 g je kg beim
     Aufbau, 1,5 g beim Abnehmen — so grob, wie es Ernachungsberatung
     ohne Labor tatsaechlich rechnet. */
  const kcalPerDay = Math.round(
    (weight * (goal === "zunehmen" ? 38 : 32)) / 10 * 10
  );

  return {
    workoutsPerWeek: minutesPerDay <= 15 ? 4 : 3,
    minutesPerWeek: minutesPerDay * (minutesPerDay <= 15 ? 4 : 3),
    stepsPerDay: 8000,
    kcalPerDay,
    proteinPerDay: Math.round(weight * (goal === "zunehmen" ? 1.8 : 1.5)),
  };
}

/** Vier Fortschrittsfotos ueber den Zeitraum, als Platzhalter. */
function buildPhotos({ start, current }) {
  const points = [
    { offset: -70, kg: start },
    { offset: -35, kg: round1(start + (current - start) * 0.5) },
    { offset: -14, kg: round1(start + (current - start) * 0.87) },
    { offset: 0, kg: current },
  ];

  return points.map((item, index) => {
    const date = addDays(dayKey(), item.offset);
    return {
      id: `p-${date}`,
      date,
      kg: item.kg,
      note: index === 0 ? "Startpunkt" : "",
      placeholder: true,
      src: placeholderPhoto({ date, weight: item.kg, index }),
    };
  });
}

/**
 * Der komplette Demodatenbestand fuer ein Profil.
 *
 * Wird an zwei Stellen gebraucht: einmal fuer die fiktive Nutzerin, und
 * einmal direkt nach dem Onboarding, damit die App mit den Angaben des
 * echten Nutzers startet statt mit einer fremden Historie.
 */
/**
 * Womit die erfundene Historie beginnt.
 *
 * Der Nutzer gibt sein *aktuelles* Gewicht an, nicht das Startgewicht.
 * Fuer die Demodaten wird deshalb ein Startgewicht berechnet, das zur
 * Richtung des Ziels passt — ein Verlauf, der bei genau dem aktuellen
 * Wert beginnt und endet, waere eine flache Linie und damit wertlos.
 */
function demoStart(profile) {
  const current = Number(profile.weight) || 75;
  const goal = profile.goal || "fit";
  const shift = goal === "zunehmen" ? 1.8 : goal === "beweglich" ? 0.9 : 2.4;
  return round1(current + shift);
}

export function demoFor(profile) {
  const current = Number(profile.weight) || 75;
  const start = Number(profile.startWeight) || demoStart(profile);

  const history = buildHistory({
    minutes: Number(profile.timePerDay) || 45,
  });

  const goals = goalsFor(profile);
  const complete = { ...profile, startWeight: start, weight: current };

  return {
    startWeight: start,
    weights: buildWeights({ start, current }),
    photos: buildPhotos({ start, current }),
    history,
    nutrition: {
      entries: buildNutrition(goals),
      water: buildWater(),
      favorites: buildFavorites(),
    },
    steps: buildSteps(goals.stepsPerDay),
    goals,
    milestones: buildMilestones(complete),
  };
}

/**
 * Meilensteine. Nur vier, und alle mit einem Datum — ein Meilenstein ohne
 * Zeitbezug ist eine Urkunde, kein Fortschritt.
 */
function buildMilestones(profile) {
  const start = Number(profile.startWeight) || 0;
  const current = Number(profile.weight) || 0;
  const delta = Math.abs(start - current);

  return [
    { id: "m1", label: "Erste Woche geschafft", icon: "sparkle", date: addDays(dayKey(), -77) },
    { id: "m2", label: "10 Workouts absolviert", icon: "trophy", date: addDays(dayKey(), -56) },
    delta >= 1
      ? {
          id: "m3",
          label: `${round1(delta)} kg ${current < start ? "abgenommen" : "zugenommen"}`,
          icon: "pulse",
          date: addDays(dayKey(), -42),
        }
      : null,
    { id: "m4", label: "5 Wochen Serie", icon: "zap", date: addDays(dayKey(), -21) },
  ].filter(Boolean);
}

/* --------------------------------------------------------------------------
   Aufbau
   -------------------------------------------------------------------------- */

export function buildSeed({ onboarded = true } = {}) {
  const profile = onboarded
    ? { ...DEMO_PROFILE }
    : {
        name: "",
        age: null,
        height: null,
        weight: null,
        startWeight: null,
        goalWeight: null,
        goal: null,
        level: null,
        timePerDay: null,
        equipment: [],
      };

  /* Ohne Profil gibt es nichts zu erfinden. Der Demobestand entsteht
     erst, wenn das Onboarding eine Person kennt — sonst wuerde die App
     jemandes Gewichtsverlauf anzeigen, bevor er irgendwen gefragt hat. */
  const demo = onboarded
    ? demoFor(profile)
    : {
        weights: [],
        photos: [],
        history: [],
        prs: [],
        nutrition: { entries: [], water: {}, favorites: [] },
        steps: [],
        goals: goalsFor({ weight: 75, timePerDay: 20, goal: "fit" }),
        milestones: [],
      };
  const now = new Date();

  return {
    version: 1,
    onboarded,

    profile: {
      ...profile,
      coach: { name: "Max Hofmann", title: "Dein Online-Coach", active: true },
    },

    settings: {
      notifications: true,
      trainingReminder: true,
      darkMode: true,
      language: "de",
      units: "metric",
      reducedData: false,
    },

    goals: demo.goals,

    weights: demo.weights,
    photos: demo.photos,
    nutrition: demo.nutrition,
    steps: demo.steps,
    workouts: { history: demo.history },
    prs: demo.prs || [],
    chat: buildChat(),
    checkins: buildCheckins(),
    milestones: buildMilestones(profile),

    meta: {
      createdAt: new Date(now.getTime() - 84 * 86400000).toISOString(),
      coachGreetedOn: dayKey(),
    },
  };
}

/** Auswahloptionen fuer Onboarding und Profil. */
export const GOAL_OPTIONS = [
  { value: "abnehmen", label: "Abnehmen", hint: "Weniger Kilos, mehr Energie" },
  { value: "zunehmen", label: "Zunehmen", hint: "Muskeln aufbauen" },
  { value: "fit", label: "Fitter werden", hint: "Ausdauer und Kraft" },
  { value: "beweglich", label: "Beweglicher werden", hint: "Beweglichkeit und Haltung" },
];

export const LEVEL_OPTIONS = [
  { value: "einsteiger", label: "Einsteigerin / Einsteiger", hint: "Neu oder nach langer Pause" },
  { value: "fortgeschritten", label: "Fortgeschritten", hint: "Regelmäßig seit über einem Jahr" },
];

export const TIME_OPTIONS = [
  { value: 10, label: "10 Minuten", hint: "Sehr wenig Zeit" },
  { value: 20, label: "20 Minuten", hint: "Der Klassiker" },
  { value: 30, label: "30 Minuten", hint: "Am Wochenende gern" },
  { value: 45, label: "45 Minuten", hint: "Wenn der Tag es hergibt" },
];

export const EQUIPMENT_OPTIONS = [
  { value: "kurzhantel", label: "Kurzhantel" },
  { value: "matte", label: "Yogamatte" },
  { value: "gummiband", label: "Gummiband" },
  { value: "stuhl", label: "Stuhl" },
  { value: "wasserflasche", label: "Wasserflasche als Gewicht" },
];
