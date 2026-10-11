/* ==========================================================================
   SIGMA PROGRESS — core/overlay.js
   --------------------------------------------------------------------------
   Modal (auf dem Telefon ein Sheet von unten) und Toast.

   Beides haengt an einem einzigen Knoten ausserhalb der Screens, damit ein
   Dialog nicht beim Screenwechsel verschwindet und nicht im Screen-Markup
   steckt.
   ========================================================================== */

import { h, clear, on } from "./dom.js";

let host = null;
let toastTimer = null;

/** Wird einmal beim Start aufgerufen. */
export function mountOverlays(root) {
  host = h("div", { class: "overlay-host" });
  root.appendChild(host);
  return host;
}

/* --------------------------------------------------------------------------
   MODAL
   -------------------------------------------------------------------------- */

let openDialog = null;

/**
 * openModal({ title, subtitle, body, actions, size })
 *
 * `body` und `actions` duerfen Funktionen sein, die den Inhalt erst beim
 * Oeffnen bauen — dann sieht ein Dialog den aktuellen Zustand und nicht
 * den von vor drei Klicks. Gibt `closeModal` zurueck.
 */
export function openModal({
  title,
  subtitle,
  body,
  actions,
  size = "",
} = {}) {
  closeModal();

  /* Wohin der Fokus zurueckgeht, wenn der Dialog weg ist. Ohne das landet
     er auf dem <body> und die Tastatur muss sich durch die ganze Seite
     wieder hochtasten. */
  const previouslyFocused =
    document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : null;

  const dialog = h(
    "div",
    {
      class: `sheet ${size ? `sheet--${size}` : ""}`,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title || "Dialog",
    },
    h("div", { class: "sheet__grip", "aria-hidden": "true" }),
    (title || subtitle) &&
      h(
        "header",
        { class: "sheet__head" },
        title && h("h2", { class: "sheet__title" }, title),
        subtitle && h("p", { class: "sheet__sub" }, subtitle),
        h(
          "button",
          { type: "button", class: "sheet__close", "aria-label": "Schliessen", onClick: () => closeModal() },
          h("svg", { class: "icon icon--sm", "aria-hidden": "true" }, h("use", { href: "#i-close" }))
        )
      ),
    h("div", { class: "sheet__body" }, typeof body === "function" ? body() : body),
    actions && h("footer", { class: "sheet__foot" }, typeof actions === "function" ? actions() : actions)
  );

  const backdrop = h(
    "div",
    {
      class: "backdrop",
      onClick: (event) => {
        if (event.target === backdrop) closeModal();
      },
    },
    dialog
  );

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;

    /* Fokus im Dialog halten. */
    const focusable = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* `on` gibt das Abmelden zurueck. Ohne das bleibt nach jedem Dialog ein
     Tastendruck-Listener liegen — nach zehn Dialogen drueckt Escape den
     zehnten noch mit. */
  const stopKeydown = on(document, "keydown", onKeydown, true);

  openDialog = {
    node: backdrop,
    restoreTo: previouslyFocused,
    close: stopKeydown,
  };

  host.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("is-open"));

  /* Erstes sinnvolles Ziel fokussieren, sonst den Dialog. */
  const target =
    dialog.querySelector("[data-autofocus]") ||
    dialog.querySelector("input, textarea, select, button:not(.sheet__close)") ||
    dialog;
  target.focus({ preventScroll: true });

  return closeModal;
}

export function closeModal() {
  if (!openDialog) return;
  const { node, restoreTo } = openDialog;
  openDialog.close();
  openDialog = null;

  node.classList.remove("is-open");
  node.addEventListener("transitionend", () => node.remove(), { once: true });

  /* Sicherheitsnetz, falls transitionend nicht kommt. */
  setTimeout(() => node.remove(), 400);

  /* Fokus zurueckgeben — aber nur, wenn der Knoten noch haengt. Nach einem
     Screenwechsel ist er weg, und dann liefe `focus` ins Leere. */
  if (restoreTo && restoreTo.isConnected) {
    restoreTo.focus({ preventScroll: true });
  } else if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
}

export function isModalOpen() {
  return Boolean(openDialog);
}

/* --------------------------------------------------------------------------
   BESTAETIGUNG
   -------------------------------------------------------------------------- */

export function confirmDialog({
  title,
  text,
  confirmLabel = "Bestätigen",
  cancelLabel = "Abbrechen",
  danger = false,
  onConfirm,
}) {
  return openModal({
    title,
    body: h("p", { class: "sheet__text" }, text),
    actions: h(
      "div",
      { class: "row", style: { width: "100%", gap: "0.5rem" } },
      h(
        "button",
        { type: "button", class: "btn btn--secondary btn--block", onClick: () => closeModal() },
        cancelLabel
      ),
      h(
        "button",
        {
          type: "button",
          class: `btn btn--block ${danger ? "btn--danger" : "btn--primary"}`,
          onClick: () => {
            closeModal();
            if (onConfirm) onConfirm();
          },
        },
        confirmLabel
      )
    ),
  });
}

/* --------------------------------------------------------------------------
   TOAST
   -------------------------------------------------------------------------- */

let toastNode = null;

/**
 * Kurze Bestätigung unten. Nicht blockierend, verschwindet von selbst.
 * `action` hängt einen Knopf an (z.B. „Aktualisieren").
 */
export function toast(message, { icon = "check", duration = 2600, action = null } = {}) {
  if (!host) return;

  if (toastTimer) clearTimeout(toastTimer);

  if (toastNode) {
    toastNode.remove();
    toastNode = null;
  }

  toastNode = h(
    "div",
    { class: "toast", role: "status" },
    h(
      "span",
      { class: "toast__icon" },
      h("svg", { class: "icon icon--sm", "aria-hidden": "true" }, h("use", { href: `#i-${icon}` }))
    ),
    h("span", { class: "toast__text" }, message),
    action &&
      h(
        "button",
        {
          type: "button",
          class: "toast__action",
          onClick: () => {
            dismissToast();
            action.onClick();
          },
        },
        action.label
      )
  );

  host.appendChild(toastNode);
  requestAnimationFrame(() => toastNode.classList.add("is-open"));

  toastTimer = setTimeout(dismissToast, duration);
}

function dismissToast() {
  if (toastTimer) clearTimeout(toastTimer);
  if (!toastNode) return;

  const node = toastNode;
  toastNode = null;
  node.classList.remove("is-open");
  setTimeout(() => node.remove(), 300);
}

/* --------------------------------------------------------------------------
   FEHLERHINWEIS (z.B. Speicher voll)
   -------------------------------------------------------------------------- */

export function errorToast(message) {
  toast(message, { icon: "bell", duration: 4200 });
}

/** Aufraeumen fuer Screenwechsel — offene Dialoge werden geschlossen. */
export function resetOverlays() {
  if (openDialog) closeModal();
  if (toastTimer) clearTimeout(toastTimer);
  if (toastNode) {
    clear(toastNode.parentNode);
    toastNode = null;
  }
}
