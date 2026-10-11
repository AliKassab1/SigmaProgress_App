/* ==========================================================================
   SIGMA PROGRESS — components/ui.js
   --------------------------------------------------------------------------
   Die wiederverwendbaren Bausteine. Jeder Screen setzt sich aus diesen
   zusammen — keine Screen-Datei erfindet eigenes Markup.
   ========================================================================== */

import { h, use } from "../core/dom.js";

/* --------------------------------------------------------------------------
   ICON
   -------------------------------------------------------------------------- */

export function Icon(name, className = "icon") {
  return use(`#i-${name}`, className);
}

/**
 * Das Zeichen der Marke, ohne Schriftzug.
 *
 * Steht in der Kopfzeile, auf der Anmeldung, im Onboarding und in der
 * Verwaltung — überall dieselbe Geometrie, nur unterschiedlich groß. Das
 * SVG ist der zugeschnittene Ausschnitt aus dem Logo.
 */
export function brandMark(size = "") {
  return h(
    "span",
    { class: `brand__mark ${size ? `brand__mark--${size}` : ""}` },
    h(
      "svg",
      { viewBox: "87.43 386.78 281.24 204.49", "aria-hidden": "true" },
      h("path", { d: "M133.16 472.55h143.53v35.35h-48.52v82.77h-46.5V507.9h-48.51z" })
    )
  );
}

/* --------------------------------------------------------------------------
   BUTTON
   -------------------------------------------------------------------------- */

const VARIANTS = {
  primary: "btn btn--primary",
  secondary: "btn btn--secondary",
  ghost: "btn btn--ghost",
};

/**
 * button({ label, onClick, variant, size, icon, block, type, ... })
 */
export function button({
  label,
  onClick,
  variant = "primary",
  size = "",
  icon,
  iconEnd,
  block = false,
  type = "button",
  disabled = false,
  className = "",
  ...rest
} = {}) {
  const classes = [
    VARIANTS[variant] || VARIANTS.primary,
    size === "lg" && "btn--lg",
    size === "sm" && "btn--sm",
    block && "btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return h(
    "button",
    { type, class: classes, onClick, disabled, ...rest },
    icon && Icon(icon),
    label,
    iconEnd && Icon(iconEnd)
  );
}

export function iconButton({ icon, label, onClick, className = "", ...rest } = {}) {
  return h(
    "button",
    { type: "button", class: `icon-btn ${className}`, "aria-label": label, onClick, ...rest },
    Icon(icon)
  );
}

/* --------------------------------------------------------------------------
   KARTE
   -------------------------------------------------------------------------- */

export function card(props = {}, ...children) {
  const { variant, glow = false, halo = false, class: extra = "", ...rest } = props;
  const classes = [
    "card",
    variant === "tight" && "card--tight",
    variant === "sunken" && "card--sunken",
    variant === "raised" && "card--raised",
    variant === "flush" && "card--flush",
    glow && "card--glow",
    halo && "card--halo",
    extra,
  ]
    .filter(Boolean)
    .join(" ");

  return h("div", { class: classes, ...rest }, ...children);
}

/** Karte, die selbst ein Knopf ist (kein div-onclick). */
export function tapCard({ onClick, label, ...props }, ...children) {
  return h(
    "button",
    { type: "button", class: "card card--tap", onClick, "aria-label": label, ...props },
    ...children
  );
}

export function cardHead(title, ...trailing) {
  return h(
    "div",
    { class: "card__head" },
    h("h2", { class: "card__title" }, title),
    trailing.length ? h("div", { class: "row", style: { gap: "0.5rem" } }, ...trailing) : null
  );
}

/* --------------------------------------------------------------------------
   TEXT
   -------------------------------------------------------------------------- */

export const label = (value, green = false) =>
  h("p", { class: green ? "label label--green" : "label" }, value);

export const meta = (value) => h("p", { class: "meta" }, value);
export const metaDim = (value) => h("p", { class: "meta-dim" }, value);

export function iconTile(icon, { variant = "", size = "" } = {}) {
  const classes = [
    "icon-tile",
    variant === "plain" && "icon-tile--plain",
    size === "sm" && "icon-tile--sm",
    size === "lg" && "icon-tile--lg",
  ]
    .filter(Boolean)
    .join(" ");
  return h("span", { class: classes }, Icon(icon));
}

/* --------------------------------------------------------------------------
   KENNZAHLEN
   -------------------------------------------------------------------------- */

/** Die Kennzahl-Kachel aus dem Design: Label, Wert, Einheit, Fusszeile. */
export function stat({ label: text, value, unit, icon, foot, delta, deltaMod = "" }) {
  return h(
    "div",
    { class: "stat" },
    h(
      "div",
      { class: "stat__top" },
      h("span", { class: "stat__label" }, text),
      icon && iconTile(icon, { size: "sm" })
    ),
    h("div", { class: "stat__value" }, String(value), unit && h("span", { class: "stat__unit" }, unit)),
    (foot || delta) &&
      h(
        "div",
        { class: "stat__foot" },
        delta &&
          h(
            "span",
            { class: `delta ${deltaMod}` },
            delta.startsWith("-") || delta.startsWith("\u2212") ? null : Icon("arrow-up", "icon icon--sm"),
            delta
          ),
        foot && h("span", null, foot)
      )
  );
}

/** Kompaktere Messwert-Kachel (zweispaltiges Raster). */
export function measure({ label: text, value, unit, delta }) {
  return h(
    "div",
    { class: "measure" },
    h("span", { class: "measure__label" }, text),
    h("div", { class: "measure__value" }, String(value), unit && h("span", { class: "stat__unit" }, unit)),
    delta && h("div", { class: "measure__delta" }, delta)
  );
}

/* --------------------------------------------------------------------------
   FORTSCHRITT
   -------------------------------------------------------------------------- */

/* `label` ist Pflicht in der Praxis: ein Balken, der neben der Zahl steht,
   sieht für den Screenreader aus wie eine namenlose Leiste. */
export function track(percent, { thin = false, muted = false, label } = {}) {
  const value = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return h(
    "div",
    {
      class: `track ${thin ? "track--thin" : ""}`,
      role: "progressbar",
      "aria-label": label || `${value} Prozent`,
      "aria-valuenow": value,
      "aria-valuemin": "0",
      "aria-valuemax": "100",
    },
    h("div", {
      class: `track__fill ${muted ? "track__fill--muted" : ""}`,
      style: { width: `${value}%` },
    })
  );
}

/**
 * Fortschrittsring als reines SVG.
 * Kein Fremdpaket, damit die App ohne Netzteil funktioniert.
 */
export function ring({ percent, size = 72, stroke = 8, value, caption, label: ariaLabel }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const offset = circumference * (1 - clamped / 100);

  return h(
    "div",
    { class: "ring-wrap", style: { width: `${size}px`, height: `${size}px` } },
    h(
      "svg",
      {
        width: size,
        height: size,
        viewBox: `0 0 ${size} ${size}`,
        role: "img",
        "aria-label": ariaLabel || `${clamped} Prozent erledigt`,
      },
      h("circle", { class: "ring__track", cx: size / 2, cy: size / 2, r: radius, "stroke-width": stroke }),
      h("circle", {
        class: "ring__value",
        cx: size / 2,
        cy: size / 2,
        r: radius,
        "stroke-width": stroke,
        "stroke-dasharray": circumference,
        "stroke-dashoffset": offset,
      })
    ),
    (value || caption) &&
      h(
        "div",
        { class: "ring-wrap__center" },
        value && h("span", { class: "ring__value-text" }, value),
        caption && h("span", { class: "ring__caption" }, caption)
      )
  );
}

/* --------------------------------------------------------------------------
   CHIPS
   -------------------------------------------------------------------------- */

export function chip(text, { variant = "", dot = false, mono = false } = {}) {
  const classes = [
    "chip",
    variant === "green" && "chip--green",
    variant === "warn" && "chip--warn",
    variant === "calm" && "chip--calm",
    mono && "chip--mono",
  ]
    .filter(Boolean)
    .join(" ");

  return h("span", { class: classes }, dot && h("span", { class: "chip__dot" }), text);
}

/* --------------------------------------------------------------------------
   SEGMENTIERTES MENU
   -------------------------------------------------------------------------- */

export function segmented(items, activeId, onSelect, { label: ariaLabel } = {}) {
  return h(
    "div",
    { class: "segmented", role: "group", "aria-label": ariaLabel || "Auswahl" },
    items.map((item) =>
      h(
        "button",
        {
          type: "button",
          class: "segmented__btn",
          "aria-pressed": item.id === activeId ? "true" : "false",
          onClick: () => onSelect(item.id),
        },
        item.label
      )
    )
  );
}

/* --------------------------------------------------------------------------
   LISTENZEILE
   -------------------------------------------------------------------------- */

export function listRow({ title, sub, icon, chevron = true, onClick, trailing, ...rest } = {}) {
  const content = [
    icon && iconTile(icon),
    h(
      "div",
      { style: { flex: "1", minWidth: "0" } },
      h("p", { class: "list__title" }, title),
      sub && h("p", { class: "list__sub" }, sub)
    ),
    trailing,
    chevron && Icon("chevron-right", "icon icon--sm list__chev"),
  ].filter(Boolean);

  if (onClick) {
    return h("button", { type: "button", class: "list__item", onClick, ...rest }, ...content);
  }
  return h("div", { class: "list__item", ...rest }, ...content);
}

export function list(...rows) {
  return h("div", { class: "list" }, ...rows);
}

/* --------------------------------------------------------------------------
   LEERZUSTAND
   -------------------------------------------------------------------------- */

export function empty({ icon = "sparkle", title, hint, action }) {
  return h(
    "div",
    { class: "empty" },
    iconTile(icon, { size: "lg", variant: "plain" }),
    h("p", { class: "empty__title" }, title),
    hint && h("p", { class: "empty__hint" }, hint),
    action
  );
}

/* --------------------------------------------------------------------------
   AVATAR
   -------------------------------------------------------------------------- */

export function avatar(text, { size = "", cool = false, alt = "" } = {}) {
  const classes = [
    "avatar",
    size === "sm" && "avatar--sm",
    size === "lg" && "avatar--lg",
    size === "xl" && "avatar--xl",
    cool && "avatar--cool",
  ]
    .filter(Boolean)
    .join(" ");

  return alt
    ? h("span", { class: classes, role: "img", "aria-label": alt }, text)
    : h("span", { class: classes, "aria-hidden": "true" }, text);
}

/* --------------------------------------------------------------------------
   ABSCHNITTSUEBERSCHRIFT
   -------------------------------------------------------------------------- */

export function sectionHead(title, ...trailing) {
  return h(
    "div",
    { class: "section__head" },
    h("h2", { class: "label" }, title),
    trailing.length ? h("div", { class: "row", style: { gap: "0.5rem" } }, ...trailing) : null
  );
}

/* --------------------------------------------------------------------------
   BODY-GRAFIK
   Kleines schematisches Koerpermodell. Zeigt, welche Muskelgruppen
   gerade gearbeitet werden — ersetzt ein Foto und bleibt trotzdem
   verstaendlich ohne Bildmaterial.
   -------------------------------------------------------------------------- */

const GROUP_LABELS = {
  beine: "Beine",
  ruecken: "Rücken",
  schultern: "Schultern",
  arme: "Arme",
  brust: "Brust",
  bauch: "Bauch",
};

export function bodyFigure(groups = [], { size = 76 } = {}) {
  const active = new Set(groups);
  const on = (key) => (active.has(key) ? "bf-part bf-part--on" : "bf-part");

  return h(
    "svg",
    {
      class: "body-figure",
      viewBox: "0 0 64 96",
      width: size,
      height: Math.round(size * 1.5),
      role: "img",
      "aria-label": `Trainierte Muskelgruppen: ${
        groups.map((key) => GROUP_LABELS[key] || key).join(", ") || "keine Angabe"
      }`,
    },
    h(
      "g",
      { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" },
      /* Kopf */
      h("circle", { class: on("gesamt"), cx: 32, cy: 9, r: 6, "stroke-width": 1.6 }),
      /* Rumpf */
      h("path", {
        class: on("ruecken"),
        d: "M20 20h24a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z",
        "stroke-width": 1.6,
      }),
      /* Brust */
      h("path", {
        class: on("brust"),
        d: "M19 23h26v9H19z",
        "stroke-width": 1.6,
        fill: "currentColor",
        "fill-opacity": active.has("brust") ? 0.18 : 0,
      }),
      /* Bauch */
      h("path", {
        class: on("bauch"),
        d: "M21 32h22v14H21z",
        "stroke-width": 1.6,
        fill: "currentColor",
        "fill-opacity": active.has("bauch") ? 0.18 : 0,
      }),
      /* Arme */
      h("path", { class: on("arme"), d: "M14 22 8 48", "stroke-width": 1.6 }),
      h("path", { class: on("arme"), d: "M50 22l6 26", "stroke-width": 1.6 }),
      /* Schultern */
      h("path", { class: on("schultern"), d: "M18 20h28", "stroke-width": 3.4 }),
      /* Beine */
      h("path", { class: on("beine"), d: "M23 50v40", "stroke-width": 1.6 }),
      h("path", { class: on("beine"), d: "M41 50v40", "stroke-width": 1.6 })
    )
  );
}

/** Legende unter der Grafik. */
export function muscleLegend(groups = []) {
  const list = groups.filter((key) => GROUP_LABELS[key]);
  if (!list.length) return null;

  return h(
    "div",
    { class: "row", style: { flexWrap: "wrap", gap: "0.3125rem" } },
    list.map((key) => chip(GROUP_LABELS[key], { variant: "green", mono: true }))
  );
}
