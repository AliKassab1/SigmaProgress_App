/* ==========================================================================
   SIGMA PROGRESS — sw.js
   --------------------------------------------------------------------------
   Der Service Worker.

   Aufgabe: Die App muss ohne Netz aufrufbar sein. Nicht mehr. Alles andere —
   Push, Background-Sync, ein Cache als Datenbank — waere fuer einen lokalen
   Prototyp Ballast, der nur Fehlerquellen schafft.

   Strategie, bewusst einfach:

     Navigation   → Netz zuerst, Cache als Rueckfall. Eine alte Version der
                    App zu zeigen, wenn eine neue existiert, ist schlimmer
                    als kurz offline zu sein.
     Sonstiges    → Cache zuerst, Netz im Hintergrund (stale-while-
                    revalidate). JS, CSS, Icons, Schriften.

   Wichtig fuer die Entwicklung: `CACHE_VERSION` muss mit jeder Aenderung an
   einer gecachten Datei hochgezahlt werden. Sonst liefert der Browser die
   alte Datei aus dem Cache und man wundert sich.

   Muss hochgezaehlt werden, sobald eine Datei aus der PRECACHE-Liste
   geaendert wurde. Das ist die einzige Stolperfalle dieses Ansatzes.
   ========================================================================== */

const CACHE_VERSION = "sigma-v20";
const CACHE_NAME = `${CACHE_VERSION}`;

/* Was beim Installieren vorgeholt wird. Die App braucht nichts weiter —
   Fonts und Bilder laufen notfalls auch ohne Cache. */
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",

  "./css/app.css",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./css/forms.css",
  "./css/overlay.css",
  "./css/screens.css",
  "./css/views.css",

  "./js/main.js",
  "./js/core/auth.js",
  "./js/core/dom.js",
  "./js/core/format.js",
  "./js/core/messages.js",
  "./js/core/overlay.js",
  "./js/core/repo.js",
  "./js/core/router.js",
  "./js/core/stats.js",
  "./js/components/charts.js",
  "./js/components/forms.js",
  "./js/components/ui.js",
  "./js/data/foods.js",
  "./js/data/photos.js",
  "./js/data/seed.js",
  "./js/screens/chat.js",
  "./js/screens/dashboard.js",
  "./js/screens/fortschritt.js",
  "./js/screens/freischaltung.js",
  "./js/screens/login.js",
  "./js/screens/admin.js",
  "./js/screens/onboarding.js",
  "./js/screens/profil.js",
  "./js/screens/tracken.js",

  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/favicon.svg",
];

/* -------------------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      /* Einzeln holen statt addAll: eine einzelne fehlende Datei darf den
         ganzen Install verhindern. */
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch (error) {
            console.warn("[sw]nicht vorgeladen:", url, error);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      /* Alte Versionen und fremde Caches entfernen. */
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("sigma-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* Nur eigene Herkunft. Google-Fonts nicht anfassen — da ist der Browser
     schneller und die Cache-Control-Header stimmen. */
  if (url.origin !== self.location.origin) return;

  /* Navigationsanfragen: Netz zuerst. */
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch (error) {
          const cached =
            (await caches.match("./index.html")) || (await caches.match("./"));
          return (
            cached ||
            new Response("Offline und nichts im Cache.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  /* Alles andere: Cache zuerst, Netz still im Hintergrund. */
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        network.catch(() => null);
        return cached;
      }

      const fresh = await network;
      if (fresh) return fresh;

      return new Response("", { status: 504, statusText: "Offline" });
    })()
  );
});
