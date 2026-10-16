/* ==========================================================================
   SIGMA PROGRESS — main.js
   --------------------------------------------------------------------------
   Einstiegspunkt. Macht fünf Dinge und sonst nichts:

     1. Daten bereitstellen        (repo.init)
     2. Anmeldung erzwingen         (Wache im render)
     3. Overlays anhaengen         (mountOverlays)
     4. Routing + Rendering        (render → screens)
     5. Service Worker registrieren

   Bildschirme kennen sich untereinander nicht. Sie bekommen den Zustand und
   einen Satz Funktionen und rendern sich selbst.
   ========================================================================== */

import { h, replace } from "./core/dom.js";
import { init, subscribe, getState, update, onError, isOnboarded, useOwner } from "./core/repo.js";
import { ensureSeeded, sessionAccount, sessionScope, signOut } from "./core/auth.js";
import { mountOverlays, errorToast, resetOverlays, closeModal, toast } from "./core/overlay.js";
import {
  ROUTES,
  currentRoute,
  navigate,
  onRouteChange,
  startRouter,
} from "./core/router.js";
import { unreadCount } from "./core/stats.js";
import { Icon, avatar } from "./components/ui.js";
import { initials } from "./core/format.js";

import renderLogin, { resetLogin } from "./screens/login.js";
import renderFreischaltung from "./screens/freischaltung.js";
import renderOnboarding from "./screens/onboarding.js";
import renderAdmin from "./screens/admin.js";
import renderDashboard from "./screens/dashboard.js";
import renderTracken from "./screens/tracken.js";
import renderChat from "./screens/chat.js";
import renderFortschritt from "./screens/fortschritt.js";
import renderProfil from "./screens/profil.js";

/* --------------------------------------------------------------------------
   Bildschirme
   -------------------------------------------------------------------------- */

const SCREENS = {
  login: renderLogin,
  freischaltung: renderFreischaltung,
  onboarding: renderOnboarding,
  admin: renderAdmin,
  dashboard: renderDashboard,
  tracken: renderTracken,
  chat: renderChat,
  fortschritt: renderFortschritt,
  profil: renderProfil,
};

/* --------------------------------------------------------------------------
   Grundgeruest
   -------------------------------------------------------------------------- */

let viewport = null;
let topbar = null;
let dockHost = null;

/**
 * Was ein Bildschirm bekommt. Alles, was er zum Handeln braucht — aber nur
 * ueber diese eine Tür. Ein Bildschirm kann den Zustand lesen, nicht
 * direkt verändern.
 */
function screenContext() {
  return {
    getState,
    update,
    navigate,
    /** Bildschirm wechseln. `tab` ist optional (nur für „Tracken"). */
    go(screenName, params = {}) {
      const target = ROUTES.find((route) => route.name === screenName);
      const base = target ? target.path : `/${screenName}`;
      navigate(params.tab ? `${base}/${params.tab}` : base);
    },
    /** Erneut zeichnen, ohne den Zustand zu verändern. `focus` ist ein
        Selektor auf das Element, das danach den Fokus bekommen soll. */
    refresh: (focus = null) => render({ keepScroll: true, focus }),
    /** Nach erfolgreicher Anmeldung. Wechselt den Datenbestand auf das
        Konto und leitet dorthin, wo man hingehört. */
    enterAccount,
    /** Abmelden und zurück zur Tür. */
    leaveAccount,
  };
}

/* --------------------------------------------------------------------------
   Anmeldung
   -------------------------------------------------------------------------- */

/**
 * Wohin es nach der Anmeldung geht.
 *
 * Drei Wege, in dieser Reihenfolge: ohne Konto zur Tür, mit Rolle Coach oder
 * Admin in die Verwaltung, als Kunde erst nach der Freischaltung und dann
 * entweder ins Onboarding oder aufs Dashboard.
 */
function startRoute() {
  const account = sessionAccount();
  if (!account) return "/login";
  if (account.role !== "kunde") return "/admin";
  if (account.status !== "freigegeben") return "/freischaltung";
  return isOnboarded() ? "/dashboard" : "/onboarding";
}

/**
 * Nach der Anmeldung: der Datenbestand gehört jetzt dem Konto und nicht mehr
 * dem Gast. Also den Speicherbereich wechseln und den Zustand neu laden —
 * erst danach zeichnen, sonst zeigt ein Bildschirm kurz die Daten des
 * falschen Kontos.
 */
async function enterAccount() {
  useOwner(sessionScope());
  await init();
  navigate(startRoute(), { replace: true });
}

/** Abmelden: Sitzung weg, Speicherbereich wieder der des Gasts. */
async function leaveAccount() {
  signOut();
  useOwner(null);
  resetLogin();
  await init();
  navigate("/login", { replace: true });
}

/* --------------------------------------------------------------------------
   Rendern
   -------------------------------------------------------------------------- */

let currentScreenName = null;
const scrollMemory = {};

/**
 * Bildschirm neu zeichnen.
 *
 * Warum neu zeichnen und nicht patchen? Die Bildschirme sind klein und der
 * Zustand ändert sich selten (nutzergetrieben). Differenzielles Zeichnen
 * würde hier mehr Code kosten als es spart. Eingabefelder leben in
 * Entwurfsobjekten der Bildschirme, nicht im Zustand.
 */
function render({ keepScroll = false, focus = null } = {}) {
  const route = currentRoute();
  const state = getState();

  if (!state) return;

  const account = sessionAccount();

  if (!account) {
    /* Ohne Anmeldung gibt es genau eine Route. Wer eine andere Adresse
       eintippt, landet trotzdem an der Tür — und danach sieht er den Grund
       dafür, statt an einem leeren Bildschirm zu sitzen. */
    if (route.name !== "login") {
      navigate("/login", { replace: true });
      return;
    }
  } else {
    if (route.name === "login") {
      navigate(startRoute(), { replace: true });
      return;
    }

    const kunde = account.role === "kunde";
    const cleared = account.status === "freigegeben";

    /* Verwaltung und App sind getrennte Bereiche: ein Kunde kommt nicht in
       die Verwaltung, ein Coach nicht in die Trainingsansicht. */
    if (!kunde && route.name !== "admin") {
      navigate("/admin", { replace: true });
      return;
    }
    if (kunde && route.name === "admin") {
      navigate(startRoute(), { replace: true });
      return;
    }

    /* Ohne Freigabe gibt es für den Kunden genau eine Seite: den Status. */
    if (kunde && !cleared && route.name !== "freischaltung") {
      navigate("/freischaltung", { replace: true });
      return;
    }
    if (kunde && cleared && route.name === "freischaltung") {
      navigate(startRoute(), { replace: true });
      return;
    }
  }

  /* Das Onboarding gibt es nur für freigegebene Kunden — Coach und Admin
     richten nichts ein. */
  if (account && account.role === "kunde" && account.status === "freigegeben") {
    if (!isOnboarded() && route.name !== "onboarding") {
      navigate("/onboarding", { replace: true });
      return;
    }
    if (isOnboarded() && route.name === "onboarding") {
      navigate("/dashboard", { replace: true });
      return;
    }
  }

  const screen = SCREENS[route.name];
  if (!screen) {
    navigate("/dashboard", { replace: true });
    return;
  }

  const switched = currentScreenName !== route.name;

  if (switched && currentScreenName) {
    scrollMemory[currentScreenName] = window.scrollY;
  }

  const scrollY = keepScroll ? window.scrollY : scrollMemory[route.name] ?? 0;
  currentScreenName = route.name;

  if (switched) resetOverlays();

  /* Kopfzeile und Dock hängen am Bildschirm, nicht am Zustand. */
  renderTopbar(route, state);
  /* Das Dock wird bei jedem Zustandswechsel neu gebaut — sonst bliebe die
     Ungelesen-Marke am Chat-Punkt stehen, bis man den Screen wechselt. */
  renderDock(route, state);

  let node;
  try {
    node = screen(screenContext(), route);
  } catch (error) {
    console.error("[sigma]Bildschirm konnte nicht gezeichnet werden.", error);
    node = renderCrash(error);
  }

  replace(viewport, node);
  viewport.setAttribute("aria-busy", "false");

  /* Freiraum fuer das Dock nur, wenn es sichtbar ist. */
  document.body.classList.toggle("has-dock", route.isMain);

  if (switched) {
    window.scrollTo({ top: scrollY, behavior: "auto" });

    /* Fokus auf das Feld, das die Tastatur braucht, sonst auf die Überschrift
       des neuen Bildschirms. Ohne das hängt die Tastatur im alten Screen und
       Screenreader lesen weiter. */
    const wanted = viewport.querySelector("[data-autofocus]");
    const target = wanted || viewport.querySelector("h1");

    if (target) {
      /* Eine Überschrift ist nicht von Natur aus fokussierbar; ein
         Eingabefeld ist es. Das tabindex gilt also nur für den Notfall. */
      if (!wanted) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      if (!wanted) target.removeAttribute("tabindex");
    }
  }

  /* Ein ausdrücklich gewünschter Fokus (z.B. das erste fehlerhafte Feld)
     gewinnt — er wird erst nach dem Zeichnen wirksam. */
  if (focus) {
    const marked = viewport.querySelector(focus);
    if (marked) marked.focus({ preventScroll: true });
  }
}

function renderCrash(error) {
  return h(
    "div",
    { class: "shell", style: { paddingTop: "1.5rem" } },
    h(
      "div",
      { class: "card card--glow" },
      h("h1", { class: "h2" }, "Da ist etwas schiefgelaufen"),
      h(
        "p",
        { class: "lead", style: { marginTop: "0.5rem" } },
        "Dieser Bereich konnte nicht geladen werden. Deine Daten sind weiterhin gespeichert."
      ),
      h(
        "p",
        { class: "meta-dim", style: { marginTop: "0.75rem" } },
        String(error && error.message ? error.message : error)
      ),
      h(
        "button",
        { type: "button", class: "btn btn--primary", style: { marginTop: "1rem" }, onClick: () => render() },
        "Erneut versuchen"
      )
    )
  );
}

/* --------------------------------------------------------------------------
   Kopfzeile
   -------------------------------------------------------------------------- */

function renderTopbar(route, state) {
  topbar.hidden = route.isFullscreen;
  if (route.isFullscreen) return;

  const name = state.profile.name || "Profil";

  replace(
    topbar,
    h(
      "div",
      { class: "topbar__inner" },
      h(
        "a",
        /* Kein `aria-label`: der sichtbare Text ist bereits der Name. Ein Label,
           das nur ergaenzt, muss den sichtbaren Text woertlich enthalten —
           sonst widerspricht es ihm. */
        { class: "brand", href: "#/dashboard" },
        h(
          "span",
          { class: "brand__mark" },
          h(
            "svg",
            { viewBox: "87.43 386.78 281.24 204.49", "aria-hidden": "true" },
            h("path", { d: "M133.16 472.55h143.53v35.35h-48.52v82.77h-46.5V507.9h-48.51z" })
          )
        ),
        h(
          "span",
          null,
          h("span", { class: "brand__name" }, "Sigma"),
          h("span", { class: "brand__sub" }, "Progress")
        )
      ),
      h(
        "a",
        { class: "icon-btn", href: "#/profil", "aria-label": `Profil von ${name}` },
        avatar(initials(name), { size: "sm" })
      )
    )
  );
}

/* --------------------------------------------------------------------------
   Untere Navigation
   -------------------------------------------------------------------------- */

function renderDock(route, state) {
  dockHost.hidden = !route.isMain;
  if (!route.isMain) return;

  const unread = unreadCount();

  replace(
    dockHost,
    h(
      "nav",
      { class: "dock", "aria-label": "Hauptnavigation" },
      h(
        "ul",
        { class: "dock__list" },
        ROUTES.map((item) => {
          const badge = item.name === "chat" ? unread : 0;

          return h(
            "li",
            null,
            h(
              "a",
              {
                class: "nav-item",
                href: `#${item.path}`,
                "aria-current": item.name === route.name ? "page" : null,
              },
              h(
                "span",
                { class: "nav-item__icon" },
                Icon(item.icon),
                badge > 0 && h("span", { class: "nav-item__badge", "aria-hidden": "true" }, String(badge))
              ),
              h("span", { class: "nav-item__label" }, item.label),
              badge > 0 && h("span", { class: "sr-only" }, `${badge} neue Nachrichten`)
            )
          );
        })
      )
    )
  );
}

/* --------------------------------------------------------------------------
   Start
   -------------------------------------------------------------------------- */

async function boot() {
  const root = document.getElementById("app");

  /* Statisches Gerüst: alles, was nicht vom Zustand abhängt. */
  replace(
    root,
    h("div", { class: "ambient", "aria-hidden": "true" }),
    (topbar = h("header", { class: "topbar" })),
    (viewport = h("main", { class: "app", id: "main", "aria-busy": "true" })),
    (dockHost = h("div", { class: "dock-host" }))
  );

  mountOverlays(document.body);
  onError(errorToast);

  /* Erst die Zugangsdaten sicherstellen, dann die Sitzung lesen und den
     Datenbestand dazu. Die Reihenfolge ist nicht beliebig: repo.js braucht
     das Konto, um den richtigen Bereich zu lesen, und die Sitzung braucht
     Konten, um sie zu prüfen. */
  await ensureSeeded();
  useOwner(sessionScope());
  await init();

  /* Jede Zustandsänderung zeichnet den aktuellen Bildschirm neu. */
  subscribe(() => render({ keepScroll: true }));
  onRouteChange(() => render());

  startRouter();

  /* Netzstatus: die App bleibt offline benutzbar, das muss man sehen. */
  const setOffline = () => document.body.classList.toggle("is-offline", !navigator.onLine);
  window.addEventListener("offline", setOffline);
  window.addEventListener("online", setOffline);
  setOffline();

  document.body.classList.add("is-ready");
  registerServiceWorker();
}

/* --------------------------------------------------------------------------
   Tastatur
   -------------------------------------------------------------------------- */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.querySelector(".backdrop")) {
    closeModal();
  }
});

/* --------------------------------------------------------------------------
   Service Worker
   -------------------------------------------------------------------------- */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  /* Über file:// gibt es keinen Service Worker. */
  if (window.location.protocol === "file:") return;

  navigator.serviceWorker
    .register("./sw.js", { scope: "./" })
    .then((registration) => {
      /* Ein neuer Worker wartet. Wir tauschen nicht ungefragt mitten im
         Training, sondern fragen nach. */
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            toast("Eine neue Version ist da", {
              icon: "refresh",
              duration: 9000,
              action: {
                label: "Laden",
                onClick: async () => {
                  await worker.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                },
              },
            });
          }
        });
      });
    })
    .catch((error) => {
      /* Ohne Service Worker läuft die App trotzdem — nur nicht offline. */
      console.warn("[sigma]Service Worker nicht registriert.", error);
    });
}

boot();
