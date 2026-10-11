/* ==========================================================================
   SIGMA PROGRESS — data/coach.js
   --------------------------------------------------------------------------
   Der Coach im Prototyp.

   KEINE KI und kein Netzwerk. Eine einfache Regel Engine:
   Nachricht -> Thema -> passende Antwort. Die Antworten kennen den echten
   Stand des Nutzers, weil sie ihn ueber `state` nachlesen.

   Diese Datei ist bewusst austauschbar: `reply(topic, context)` ist die
   einzige Stelle, die ein echtes Modell oder eine API aufrufen wuerde.
   ========================================================================== */

import {
  bmi,
  bmiLabel,
  doneToday,
  goalProgress,
  lastWorkout,
  minutesThisWeek,
  nextCheckin,
  trainingOn,
  weekStreak,
  weightChange,
  workoutsThisWeek,
} from "../core/stats.js";
import { dayKey, fmtDate, fmtDecimal, fmtKg, fmtMinutes, plural, shortName } from "../core/format.js";

/** Schnellantworten, abhaengig vom aktuellen Stand. */
export function quickReplies(state) {
  if (doneToday(state)) {
    return ["Wie lief es?", "Was mache ich als Nächstes?", "Danke!"];
  }
  return [
    "Warst du heute beim Training?",
    "Wie ernähr ich mich?",
    "Motivation fehlt",
  ];
}

/** Themenerkennung — Schluesselwortliste, Absicht gewinnt vor Fragezeichen. */
const TOPICS = [
  { topic: "ernaehrung", label: "Ernährung", words: ["ernähr", "ernaehr", "kalorien", "protein", "essen", "ernährung", "diät", "-diaet", "hunger", "satt", "mahlzeit"] },
  { topic: "uebungen", label: "Übungen", words: ["übung", "uebung", "übungen", "uebungen", "technique", "technik", "wie mache", "ausführen", "schmerz", "korrekt"] },
  { topic: "planung", label: "Planung", words: ["plan", "woche", "reihenfolge", "wie oft", "wie viele", "termin", "ablauf", "reihenfolge", "einsteigen", "starten"] },
  { topic: "motivation", label: "Motivation", words: ["motivation", "lust", "mühe", "muehe", "faul", "schlechter tag", "kein bock", "aufgeben", "motivation", "motiviert"] },
  { topic: "fortschritt", label: "Fortschritt", words: ["fortschritt", "ziel", "gewicht", "abgenommen", "wie viel", "plateau", "wie weit", "trend"] },
  { topic: "training", label: "Training", words: ["training", "trainieren", "workout", "übung", "gewicht", "hantel", "pause", "sätze", "sets", "cardio", "kondition"] },
];

export function classify(text) {
  const lower = String(text || "").toLowerCase();

  for (const entry of TOPICS) {
    if (entry.words.some((word) => lower.includes(word))) return entry.topic;
  }
  return "allgemein";
}

/* --------------------------------------------------------------------------
   Antworten
   -------------------------------------------------------------------------- */

const REPLIES = {
  training(ctx) {
    const today = ctx.session;
    const last = ctx.last;
    const count = ctx.week;
    const target = ctx.target;

    if (today) {
      return [
        `Schön, dass du heute trainiert hast — **${today.name}** über ${today.minutes} Minuten${today.withCoach ? ", mit Trainer" : ""}.`,
        today.note ? `Zu deiner Notiz: „${today.note}“.` : null,
        `Damit hast du diese Woche ${count} von ${target} ${plural(target, "Einheit", "Einheiten")} erledigt.`,
      ].filter(Boolean);
    }

    return [
      `Diese Woche hast du ${count} von ${target} ${plural(target, "Einheit", "Einheiten")} erledigt.`,
      last
        ? `Deine letzte Einheit: **${last.name}** am ${fmtDate(last.date)}, ${last.minutes} Minuten.`
        : "Noch ist keine Einheit eingetragen.",
      "Trag unter Tracken → Training ein, was du heute mit deinem Trainer gemacht hast — das zählt für Verlauf und Serie.",
    ];
  },

  /* `kcal`/`protein` liegen in `ctx.nutrition`, das aktuelle Gewicht in
     `ctx.progress.current` — beide erst beim Zusammenbauen des Kontexts.
     Die Ziele heissen `kcalPerDay`/`proteinPerDay`, nicht `kcal`.
     Die Proteinzahl kommt aus dem Ziel des Nutzers statt aus einer
     Faustregel: eine eigene Rechnung driftet sonst vom Profil weg. */
  ernaehrung(ctx) {
    const { targets, nutrition, progress } = ctx;
    const weight = progress.current || 0;
    const today = nutrition || { kcal: 0, protein: 0 };
    const perMeal = Math.round(targets.proteinPerDay / 4);

    return [
      `Dein Ziel liegt bei **${targets.kcalPerDay} kcal** mit **${targets.proteinPerDay} g Protein** pro Tag. Erfasst hast du heute ${today.kcal} kcal und ${today.protein} g.`,
      `Für ${fmtDecimal(weight)} kg Gewicht sind etwa ${targets.proteinPerDay} g Protein sinnvoll. Das sind rund ${perMeal} g pro Mahlzeit — auf vier verteilt gelingt das leichter, als alles in eine zu packen.`,
      "Der einfachste Hebel: zu jeder Mahlzeit eine Proteinquelle und ein Gemüse. Mehr braucht es für den Anfang nicht.",
    ];
  },

  motivation(ctx) {
    const { streak, done, name } = ctx;
    const doneLines = [];

    if (done) {
      doneLines.push("Du hast heute schon trainiert. Der schwierigste Teil ist damit erledigt.");
    }
    if (streak.current > 1) {
      doneLines.push(`Deine Serie steht bei **${streak.current} ${plural(streak.current, "Woche", "Wochen")}** in Folge. Das ist der Teil, der wirklich zählt.`);
    }

    return [
      `Das Gefühl ist normal, ${name}. Motivation ist kein Zustand, sondern ein Nebenprodukt — man wartet nicht darauf, man fängt an.`,
      ...doneLines,
      "Wenn heute nichts geht: zehn Minuten, irgendwas. Der Einstieg ist der Teil, den niemand sieht.",
    ];
  },

  uebungen() {
    return [
      "Bei den Übungen vor Ort gilt: Technik vor Gewicht. Dein Trainer passt Umfang und Belastung an dich an — vertrau darauf.",
      "Wenn du etwas Genaues wissen willst, frag deinen Trainer direkt an der Hantel. Ich kann dir sonst nur allgemeine Anhaltspunkte zur Ausführung geben.",
    ];
  },

  planung(ctx) {
    const { week, target, streak } = ctx;
    return [
      `Dein Wochenziel sind **${target} Einheiten**. Diese Woche hast du **${week}** geschafft.`,
      streak.current > 0
        ? `Damit läuft deine Serie weiter — bei ${streak.current} ${plural(streak.current, "Woche", "Wochen")} in Folge.`
        : "Noch ist diese Woche offen. Ein Termin, der schon im Kalender steht, ist einer, der stattfindet.",
      "Die Einheiten bei deinem Trainer sind der Kern. Essen und Gewicht trackst du in der App — so sehen wir, was wirklich wirkt.",
    ];
  },

  fortschritt(ctx) {
    const { change, progress, minutes, workouts, streak } = ctx;
    const direction = change < 0 ? "abgenommen" : change > 0 ? "zugenommen" : "gehalten";
    return [
      `Seit Beginn ${direction} **${fmtDecimal(Math.abs(change))} kg** — du bist bei **${fmtKg(progress.current)}** und damit zu ${progress.percent} % deines Ziels.`,
      progress.remaining > 0
        ? `Noch ${fmtDecimal(progress.remaining)} kg bis ${fmtKg(progress.target)}.`
        : "Dein Zielgewicht ist erreicht — jetzt geht es um Erhalt.",
      `Dazu ${workouts} ${plural(workouts, "Training", "Trainings")} und ${fmtMinutes(minutes)} in dieser Woche. Serie: ${streak.current} ${plural(streak.current, "Woche", "Wochen")}.`,
      "Deine Fotos und die Messwerte findest du unter Fortschritt — dort siehst du den Verlauf genauer.",
    ];
  },

  allgemein(ctx) {
    const { name } = ctx;
    return [
      `Klar, ${name}. Ich bin dein Coach — für Training mit deinem Trainer, Ernährung, Fortschritt und Motivation.`,
      "Ein paar Beispiele, womit ich dir helfen kann:",
      "• „Warst du heute beim Training?“ — dein Eintrag und der Wochenstand",
      "• „Wie viel Protein brauche ich?“ — Zielwerte und heutiger Stand",
      "• „Meine Woche war schlecht“ — Motivation und Planung",
    ];
  },
};

/* --------------------------------------------------------------------------
   Zusammenbauen des Kontexts
   -------------------------------------------------------------------------- */

function buildContext(state) {
  const session = trainingOn(state, dayKey());
  const progress = goalProgress(state);
  const nutrition = state.nutrition.entries
    .filter((entry) => entry.date === dayKey())
    .reduce(
      (sum, entry) => ({
        kcal: sum.kcal + entry.kcal,
        protein: sum.protein + entry.protein,
      }),
      { kcal: 0, protein: 0 }
    );

  const weeklyCount = workoutsThisWeek(state).length;

  return {
    state,
    name: shortName(state.profile.name || "du").replace(/\.$/, ""),
    session,
    done: !!session,
    progress,
    nutrition,
    targets: state.goals,
    /* Beide Felder meinen dasselbe: Einheiten dieser Woche. */
    week: weeklyCount,
    workouts: weeklyCount,
    minutes: minutesThisWeek(state),
    streak: weekStreak(state),
    change: weightChange(state),
    target: state.goals.workoutsPerWeek,
    last: lastWorkout(state),
    checkin: nextCheckin(state),
    bmi: bmi(state),
    bmiLabel: bmiLabel(bmi(state)),
  };
}

/**
 * Antworttext fuer eine Nutzernachricht.
 * Gibt ein Array von Absaetzen zurueck — der Chat zeigt sie als Blasen.
 */
export function reply(text, state) {
  const topic = classify(text);
  const ctx = buildContext(state);
  const handler = REPLIES[topic] || REPLIES.allgemein;
  return handler(ctx);
}

/** Begruessung beim ersten Öffnen an einem Tag — vom Coach, nicht erzwungen. */
export function proactiveGreeting(state) {
  const ctx = buildContext(state);
  const checkin = ctx.checkin;
  const count = state.workouts.history.length;

  if (!ctx.done) {
    if (count === 0) {
      return `Willkommen, ${ctx.name}! Dein Weg beginnt beim Training mit deinem Trainer — danach trackst du hier Essen und Gewicht.`;
    }
    if (ctx.streak.current === 0) {
      return `Neue Woche, ${ctx.name}. Dein Ziel sind ${ctx.target} Einheiten. Was steht heute mit dem Trainer an?`;
    }
    return `Schön, dass du da bist, ${ctx.name}. Warst du heute schon beim Training?`;
  }

  if (checkin) {
    return `Training erledigt — stark. Dein Check-in beim Coach ist für den ${checkin.date} vorgemerkt.`;
  }

  return "Alles erledigt für heute. Geniess den Rest.";
}

/** Ungelesen-Marke zuruecksetzen, sobald der Chat geoeffnet wird. */
export function markAllRead(state) {
  state.chat.forEach((message) => {
    if (message.role === "coach") message.read = true;
  });
}
