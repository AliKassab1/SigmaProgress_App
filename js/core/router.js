/* ==========================================================================
   SIGMA PROGRESS — core/router.js
   --------------------------------------------------------------------------
   Hash-Routing. Bewusst ohne Bibliothek: jede Route hat hoechstens einen
   Parameter, und den liest der Bildschirm selbst aus `route.param`.

     #/login              Anmeldung — der einzige Weg hinein
     #/freischaltung      Warteseite, solange der Zugang nicht freigegeben ist
     #/onboarding/<n>     Einrichtung des Kunden
     #/dashboard
     #/tracken            optional: #/tracken/gewicht
     #/chat
     #/fortschritt
     #/profil
     #/admin              Verwaltung
     #/admin/<bereich>    uebersicht, anfragen, kunden, coaches, abo

   `ROUTES` ist nur die untere Leiste der Kunden-App. Alles andere haengt an
   derselben Namensaufloesung in main.js und braucht keinen Eintrag.
   ========================================================================== */

export const ROUTES = [
  { name: "dashboard", path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { name: "tracken", path: "/tracken", label: "Tracken", icon: "tracken" },
  { name: "chat", path: "/chat", label: "Chat", icon: "chat" },
  { name: "fortschritt", path: "/fortschritt", label: "Fortschritt", icon: "fortschritt" },
  { name: "profil", path: "/profil", label: "Profil", icon: "profil" },
];

/** Routen, auf denen die untere Leiste sichtbar ist. */
export const MAIN_ROUTES = ROUTES.map((route) => route.name);

/** Routen ohne Dock: dort stoert es nur. */
const FULLSCREEN_ROUTES = ["login", "freischaltung", "onboarding", "admin", "summary"];

const listeners = new Set();

/** Aktuelle Route. */
export function currentRoute() {
  return parse(window.location.hash);
}

function parse(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const parts = path.split("/").filter(Boolean);
  const name = parts[0] || "dashboard";
  const param = parts.slice(1).join("/") || null;

  return {
    name,
    param,
    path,
    isMain: MAIN_ROUTES.includes(name),
    isFullscreen: FULLSCREEN_ROUTES.includes(name),
  };
}

/** Wechselt programmatisch (z.B. nach dem Onboarding). */
export function navigate(path, { replace = false } = {}) {
  const target = path.startsWith("#") ? path : `#${path}`;

  if (replace && window.history.replaceState) {
    window.history.replaceState(null, "", target);
    emit();
    return;
  }

  if (window.location.hash === target) {
    emit();
    return;
  }

  window.location.hash = target;
}

/** Beobachter anlegen. Liefert eine Abmeldefunktion. */
export function onRouteChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  const route = currentRoute();
  for (const listener of listeners) listener(route);
}

/** Startet das Routing. Ein Aufruf pro App-Lebensdauer. */
export function startRouter() {
  window.addEventListener("hashchange", emit);

  /* Ohne Hash direkt ins Dashboard — sonst landet man auf einer leeren Seite.
     Wer nicht angemeldet ist, wird von der Wache in main.js sofort auf die
     Anmeldeseite umgeleitet; dieser erste Sprung spart nur einen Umweg. */
  if (!window.location.hash) {
    navigate("/dashboard", { replace: true });
  } else {
    emit();
  }
}
