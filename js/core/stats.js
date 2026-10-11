/* ==========================================================================
   SIGMA PROGRESS — core/stats.js
   --------------------------------------------------------------------------
   Ableitungen aus dem gespeicherten Zustand.

   Wichtig: hier wird nichts erfunden. Jede Zahl ist entweder ein
   Summenwert ueber das, was der Nutzer eingegeben hat, oder eine einfache,
   nachvollziehbare Kennzahl (BMI, Wochenquote, Differenz).

   Diese Datei ist die einzige Quelle fuer solche Werte — dadurch zeigen
   Dashboard, Fortschritt und Profil nie verschiedene Zahlen.
   ========================================================================== */

import {
  addDays,
  dayKey,
  daysBetween,
  parseDay,
  weekStart,
} from "./format.js";

/* --------------------------------------------------------------------------
   Trainingstagebuch — die Arten, die ein Eintrag haben kann
   -------------------------------------------------------------------------- */

export const TRAINING_KINDS = [
  { id: "kraft", label: "Krafttraining" },
  { id: "cardio", label: "Cardio & Ausdauer" },
  { id: "mobil", label: "Mobilität & Dehnen" },
  { id: "yoga", label: "Yoga" },
  { id: "sonstiges", label: "Sonstiges" },
];

export function trainingKindLabel(kind) {
  const found = TRAINING_KINDS.find((item) => item.id === kind);
  return found ? found.label : kind || "Training";
}

/** Wie anstrengend eine Einheit war — drei Stufen, mehr braucht es nicht. */
export const INTENSITIES = [
  { id: "leicht", label: "Leicht" },
  { id: "mittel", label: "Mittel" },
  { id: "hoch", label: "Hoch" },
];

export function intensityLabel(id) {
  const found = INTENSITIES.find((item) => item.id === id);
  return found ? found.label : "Mittel";
}

/* --------------------------------------------------------------------------
   Datum
   -------------------------------------------------------------------------- */

/** 0 = Montag … 6 = Sonntag. */
export function weekdayIndex(key) {
  return (parseDay(key).getDay() + 6) % 7;
}

/* --------------------------------------------------------------------------
   Gewicht
   -------------------------------------------------------------------------- */

/** Neuester Gewichtseintrag, nach Datum sortiert. */
export function latestWeight(state) {
  const sorted = [...state.weights].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted[0] || null;
}

export function weightOn(state, key) {
  const sorted = state.weights
    .filter((entry) => entry.date <= key)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted[0] || null;
}

/** Gewichtsreihe fuer ein Diagramm. `days` Fenster, aufsteigend. */
export function weightSeries(state, days = 84) {
  const from = addDays(dayKey(), -days);
  return state.weights
    .filter((entry) => entry.date >= from)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((entry) => ({ date: entry.date, kg: entry.kg }));
}

/** Differenz zum hoechsten Eintrag (Startgewicht) — negativ = abgenommen. */
export function weightChange(state, days = 84) {
  const series = weightSeries(state, days);
  if (series.length < 2) return 0;
  const first = series[0].kg;
  const last = series[series.length - 1].kg;
  return Math.round((last - first) * 10) / 10;
}

/** Fortschritt zum Zielgewicht, 0…100. */
export function goalProgress(state) {
  const { startWeight, goalWeight } = state.profile;
  const current = latestWeight(state)?.kg ?? state.profile.weight ?? startWeight;

  if (!startWeight || !goalWeight || startWeight === goalWeight) {
    return { current, start: startWeight, target: goalWeight, percent: 0, done: false, remaining: 0 };
  }

  const span = Math.abs(startWeight - goalWeight);
  const covered = span - Math.abs(goalWeight - current);
  const percent = Math.max(0, Math.min(100, Math.round((covered / span) * 100)));

  return {
    current,
    start: startWeight,
    target: goalWeight,
    percent,
    done: Math.abs(goalWeight - current) < 0.3,
    remaining: Math.round(Math.max(0, Math.abs(goalWeight - current)) * 10) / 10,
  };
}

/** BMI — eine der wenigen echten Formeln, bewusst sichtbar gemacht. */
export function bmi(state) {
  const { height, weight } = state.profile;
  const current = latestWeight(state)?.kg ?? weight;
  if (!height || !current) return null;
  const metres = height / 100;
  return Math.round((current / (metres * metres)) * 10) / 10;
}

export function bmiLabel(value) {
  if (value === null) return "—";
  if (value < 18.5) return "Untergewicht";
  if (value < 25) return "Im Bereich";
  if (value < 30) return "Übergewicht";
  return "Deutlich über";
}

/* --------------------------------------------------------------------------
   Workouts
   -------------------------------------------------------------------------- */

export function totalWorkouts(state) {
  return state.workouts.history.length;
}

export function totalMinutes(state) {
  return state.workouts.history.reduce((sum, item) => sum + (item.minutes || 0), 0);
}

/** Alle Einheiten zwischen zwei Tagen (einschliesslich). */
export function workoutsBetween(state, from, to) {
  return state.workouts.history.filter(
    (item) => item.date >= from && item.date <= to
  );
}

export function workoutsThisWeek(state) {
  const monday = weekStart();
  return workoutsBetween(state, monday, dayKey());
}

export function minutesThisWeek(state) {
  return workoutsThisWeek(state).reduce((sum, item) => sum + (item.minutes || 0), 0);
}

export function minutesInLastDays(state, days) {
  const from = addDays(dayKey(), -days + 1);
  return workoutsBetween(state, from, dayKey()).reduce(
    (sum, item) => sum + (item.minutes || 0),
    0
  );
}

export function doneToday(state) {
  const today = dayKey();
  return state.workouts.history.some((item) => item.date === today);
}

/**
 * Vergleich fuer den Trainingsbestand: die neueste Einheit zuerst. Beim
 * gleichen Kalendertag entscheidet der Zeitstempel — sonst stünde das
 * zuletzt gespeicherte Training nicht oben.
 */
export function bySessionDate(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const left = a.completedAt || "";
  const right = b.completedAt || "";
  if (left === right) return 0;
  return left < right ? 1 : -1;
}

export function lastWorkout(state) {
  const sorted = [...state.workouts.history].sort(bySessionDate);
  return sorted[0] || null;
}

/** Der Trainingseintrag eines Tages (ein Eintrag pro Tag) — oder null. */
export function trainingOn(state, key) {
  return state.workouts.history.find((item) => item.date === key) || null;
}

/** Wochenreihe fuer Balkendiagramme: eine Zeile je Woche. */
export function weeklySeries(state, weeks = 8) {
  const monday = weekStart();
  const out = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(monday, -7 * i);
    const end = addDays(start, 6);
    const sessions = workoutsBetween(state, start, end);
    out.push({
      start,
      end,
      workouts: sessions.length,
      minutes: sessions.reduce((sum, item) => sum + (item.minutes || 0), 0),
    });
  }

  return out;
}

/**
 * Serie in Wochen: aufeinanderfolgende Kalenderwochen, in denen das
 * Wochenziel erreicht wurde. Ein Wochentag ist keine Serie — bei drei
 * Einheiten pro Woche waere eine Tageszaehlung demotivierend und falsch.
 */
export function weekStreak(state) {
  const monday = weekStart();
  let current = 0;

  for (let i = 0; i < 60; i++) {
    const start = addDays(monday, -7 * i);
    const sessions = workoutsBetween(state, start, addDays(start, 6));
    const hit = sessions.length >= (state.goals.workoutsPerWeek || 3);

    if (hit) current += 1;
    else if (i === 0) continue; /* laufende Woche zaehlt noch nicht */
    else break;
  }

  /* Beste Serie ueber alle Wochen finden. */
  let best = 0;
  let run = 0;
  for (let i = 52; i >= 0; i--) {
    const start = addDays(monday, -7 * i);
    const sessions = workoutsBetween(state, start, addDays(start, 6));
    if (sessions.length >= (state.goals.workoutsPerWeek || 3)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  return { current, best };
}

/* --------------------------------------------------------------------------
   Schritte
   -------------------------------------------------------------------------- */

export function stepsOn(state, key) {
  return state.steps.find((entry) => entry.date === key)?.count ?? 0;
}

export function stepsLastDays(state, days = 7) {
  const from = addDays(dayKey(), -days + 1);
  return state.steps
    .filter((entry) => entry.date >= from)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* --------------------------------------------------------------------------
   Ernaehrung
   -------------------------------------------------------------------------- */

/** Summen eines Tages. */
export function nutritionOn(state, key) {
  const entries = state.nutrition.entries.filter((entry) => entry.date === key);
  return entries.reduce(
    (sum, entry) => ({
      kcal: sum.kcal + entry.kcal,
      protein: sum.protein + entry.protein,
      carbs: sum.carbs + entry.carbs,
      fat: sum.fat + entry.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function nutritionEntriesOn(state, key) {
  return state.nutrition.entries.filter((entry) => entry.date === key);
}

/** Getrunkenes Wasser an einem Tag in Millilitern. */
export function waterOn(state, key) {
  return (state.nutrition.water || {})[key] || 0;
}

/* --------------------------------------------------------------------------
   Coaching
   -------------------------------------------------------------------------- */

export function nextCheckin(state) {
  const open = state.checkins
    .filter((item) => item.status === "offen")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return open[0] || null;
}

export function lastCheckin(state) {
  const done = state.checkins
    .filter((item) => item.status === "erledigt")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return done[0] || null;
}

/** Ungelesene Coach-Nachrichten — der Badge am Chat-Punkt. */
export function unreadCount(state) {
  return state.chat.filter((item) => item.role === "coach" && !item.read).length;
}

export function recentPrs(state, limit = 5) {
  return [...(state.prs || [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

/* --------------------------------------------------------------------------
   Tagesimpuls (Mindset) — deterministisch, damit der Satz nicht bei jedem
   Neuladen wechselt.
   -------------------------------------------------------------------------- */

export const MINDSETS = [
  "Du musst nicht jeden Tag gewinnen. Du musst nur aufhören aufzugeben.",
  "Zwanzig Minuten, die stattfinden, schlagen zweihundert, die geplant sind.",
  "Fortschritt ist leise. Er merkt sich nicht in einer Woche, sondern in einem Jahr.",
  "Der schlechteste Satz ist der, den du nicht machst. Der zweitschlechteste ist der zu schwere.",
  "Du trainierst nicht, um etwas zu werden. Du trainierst, um etwas behalten zu können.",
  "Konsistenz schlägt Intensität. Fast immer.",
  "Wenn du morgen keine Zeit hast, mach die Hälfte. Verlier dich nicht.",
  "Dein Körper merkt sich, was du regelmässig tust — nicht, was du einmal tust.",
  "Nicht die Woche zählt, sondern die Richtung.",
  "Der Widerstand ist nicht das Problem. Das Wiederholen ist es.",
];

export function mindsetOfDay(seed = dayKey()) {
  const hash = seed.split("-").reduce((sum, part) => sum + Number(part), 0);
  return MINDSETS[hash % MINDSETS.length];
}

/* --------------------------------------------------------------------------
   Was heute zu tun ist — die eine Frage auf dem Dashboard
   -------------------------------------------------------------------------- */

/**
 * Genau drei Aufgaben, nach Dringlichkeit sortiert. Bewusst nicht mehr:
 * wer viele Aufgaben sieht, erledigt keine.
 */
export function todayTasks(state) {
  const session = trainingOn(state, dayKey());
  const checkin = nextCheckin(state);
  const steps = stepsOn(state, dayKey());
  const tasks = [];

  tasks.push({
    id: "workout",
    label: session ? "Training eingetragen" : "Training eintragen",
    hint: session
      ? `${session.name} · ${session.minutes} Minuten`
      : "Was du mit deinem Trainer gemacht hast",
    done: !!session,
    action: session ? null : { screen: "tracken", tab: "training", label: "Eintragen" },
    icon: session ? "check" : "dumbbell",
  });

  if (checkin && daysBetween(dayKey(), checkin.date) <= 2) {
    tasks.push({
      id: "checkin",
      label: "Check-in beim Coach",
      hint: daysBetween(dayKey(), checkin.date) === 0 ? "Heute fällig" : "Demnächst fällig",
      done: false,
      action: { screen: "profil", label: "Öffnen" },
      icon: "camera",
    });
  }

  if (state.settings.notifications && !state.weights.some((entry) => entry.date === dayKey())) {
    tasks.push({
      id: "weight",
      label: "Gewicht wiegen",
      hint: "Dauert 30 Sekunden",
      done: false,
      action: { screen: "tracken", tab: "gewicht", label: "Eintragen" },
      icon: "ruler",
    });
  }

  /* Erinnerung nur, wenn heute noch gar nichts erfasst wurde. */
  if (state.nutrition.entries.length && !state.nutrition.entries.some((entry) => entry.date === dayKey())) {
    tasks.push({
      id: "nutrition",
      label: "Erste Mahlzeit eintragen",
      hint: "Damit du siehst, wo du stehst",
      done: false,
      action: { screen: "tracken", tab: "ernaehrung", label: "Eintragen" },
      icon: "utensils",
    });
  }

  if (steps < (state.goals.stepsPerDay || 8000)) {
    tasks.push({
      id: "steps",
      label: `${state.goals.stepsPerDay.toLocaleString("de-CH")} Schritte`,
      hint: `${steps.toLocaleString("de-CH")} geschafft`,
      done: false,
      progress: steps / (state.goals.stepsPerDay || 8000),
      action: null,
      icon: "steps",
    });
  }

  return tasks.slice(0, 3);
}
