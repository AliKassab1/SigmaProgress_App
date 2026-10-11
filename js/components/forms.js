/* ==========================================================================
   SIGMA PROGRESS — components/forms.js
   --------------------------------------------------------------------------
   Eingabefelder. Zielgruppe sind Menschen, die wenig Zeit haben und wenig
   Erfahrung: grosse Trefferflaechen, klar beschriftet, Zahleneingaben mit
   passender Tastatur, und nach dem Speichern sofort sichtbar, was passiert.
   ========================================================================== */

import { h } from "../core/dom.js";
import { Icon } from "./ui.js";

/* --------------------------------------------------------------------------
   FELD (Rahmen um eine Eingabe)
   -------------------------------------------------------------------------- */

/**
 * field({ label, hint, control, error, suffix })
 *
 * Die Beschriftung bindet sich ueber `for` an das Control — darum bekommt
 * das Control hier seine ID gesetzt, falls es noch keine hat.
 */
export function field({ label, hint, suffix, error, control }) {
  if (!control) return null;

  if (!control.id) {
    control.id = `f-${Math.random().toString(36).slice(2, 9)}`;
  }

  return h(
    "div",
    { class: `field ${error ? "field--error" : ""}` },
    label && h("label", { class: "field__label", for: control.id }, label),
    h(
      "div",
      { class: "field__control" },
      control,
      suffix && h("span", { class: "field__suffix" }, suffix)
    ),
    (hint || error) && h("p", { class: error ? "field__error" : "field__hint" }, error || hint)
  );
}

/* --------------------------------------------------------------------------
   TEXT- UND ZAHLFELD
   -------------------------------------------------------------------------- */

/**
 * textInput({ value, onInput, onChange, type, placeholder, ... })
 *
 * `onInput` schreibt nur in einen Entwurf und loest KEIN Neu-Rendern aus —
 * sonst springt der Cursor beim Tippen. Gespeichert wird ueber `onChange`
 * (Blur oder Enter).
 */
export function textInput({
  value = "",
  onInput = null,
  onChange = null,
  type = "text",
  placeholder = "",
  autofocus = false,
  min,
  max,
  step,
  inputMode,
  maxLength,
  key,
  ...rest
} = {}) {
  return h("input", {
    type,
    class: "input",
    value: value ?? "",
    placeholder,
    min,
    max,
    step,
    inputMode,
    maxLength,
    ...(key ? { "data-fkey": key } : {}),
    ...(autofocus ? { "data-autofocus": "" } : {}),
    onInput: onInput ? (event) => onInput(event.target.value, event) : null,
    onChange: onChange ? (event) => onChange(event.target.value, event) : null,
    onKeydown: (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (onChange) onChange(event.target.value, event);
      }
    },
    ...rest,
  });
}

export function textarea({ value = "", onInput, onChange, placeholder = "", rows = 3, maxLength = 400 } = {}) {
  const el = h("textarea", {
    class: "input input--area",
    rows,
    placeholder,
    maxLength,
    onInput: onInput ? (event) => onInput(event.target.value, event) : null,
    onChange: onChange ? (event) => onChange(event.target.value, event) : null,
  });
  el.value = value;
  return el;
}

/**
 * Zahlenfeld mit Plus/Minus — schneller als Tippen und mit klarer
 * Trefferflaeche fuer Daumen. Das Zahlfeld selbst ist die Anzeige, es gibt
 * also keine zweite Zahl im Bild.
 *
 * `onChange` feuert bei jeder Aenderung (Tippen oder Plus/Minus), nicht
 * erst beim Verlassen — das ist hier Absicht, weil die Aenderung unmittelbar
 * in die Vorschau uebernommen wird.
 */
export function numberStepper({
  value = 0,
  onChange = null,
  min = 0,
  max = 999,
  step = 1,
  suffix,
  label: ariaLabel,
  big = false,
  name,
} = {}) {
  let current = Number(value) || 0;

  const input = h("input", {
    type: "number",
    class: `stepper__input ${big ? "stepper__input--big" : ""}`,
    value: current,
    min,
    max,
    step,
    inputMode: "decimal",
    "aria-label": ariaLabel || "Wert",
    ...(name ? { name } : {}),
    onInput: (event) => {
      const next = clamp(Number(event.target.value), min, max);
      if (Number.isNaN(next)) return;
      current = next;
      if (onChange) onChange(next);
    },
    onBlur: (event) => {
      const next = clamp(Number(event.target.value) || 0, min, max);
      current = next;
      event.target.value = next;
      if (onChange) onChange(next);
    },
    onKeydown: (event) => {
      if (event.key === "Enter") event.target.blur();
    },
  });

  const commit = (delta) => {
    const next = clamp(Math.round((current + delta) * 10) / 10, min, max);
    current = next;
    input.value = next;
    if (onChange) onChange(next);
  };

  return h(
    "div",
    { class: `stepper ${big ? "stepper--big" : ""}` },
    h(
      "button",
      { type: "button", class: "stepper__btn", "aria-label": `Weniger ${stepSuffix(step)}`, onClick: () => commit(-step) },
      Icon("minus")
    ),
    h("div", { class: "stepper__center" }, input, suffix && h("span", { class: "stepper__suffix" }, suffix)),
    h(
      "button",
      { type: "button", class: "stepper__btn", "aria-label": `Mehr ${stepSuffix(step)}`, onClick: () => commit(step) },
      Icon("plus")
    )
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stepSuffix(step) {
  return step === 1 ? "um eins" : `um ${String(step).replace(".", ",")}`;
}

/* --------------------------------------------------------------------------
   AUSWAHL
   -------------------------------------------------------------------------- */

export function select({ value, options, onChange, label: ariaLabel } = {}) {
  const el = h(
    "select",
    {
      class: "input input--select",
      "aria-label": ariaLabel,
      onChange: (event) => onChange(event.target.value),
    },
    options.map((option) =>
      h("option", { value: option.value, selected: option.value === value }, option.label)
    )
  );
  el.value = value;
  return el;
}

/* --------------------------------------------------------------------------
   AUSWAHL-KACHELN (Onboarding, Ziel, Level …)
   Die beschriftete Variante. Gross genug zum Antippen.
   -------------------------------------------------------------------------- */

export function optionGroup({ options, selected, onSelect, name, columns = 2 }) {
  return h(
    "div",
    { class: "options", style: { "--cols": columns }, role: "radiogroup", "aria-label": name },
    options.map((option) =>
      h(
        "button",
        {
          type: "button",
          class: `option ${option.value === selected ? "option--on" : ""}`,
          role: "radio",
          "aria-checked": option.value === selected ? "true" : "false",
          onClick: () => onSelect(option.value),
        },
        h(
          "span",
          { class: "option__body" },
          h("span", { class: "option__label" }, option.label),
          option.hint && h("span", { class: "option__hint" }, option.hint)
        ),
        h("span", { class: "option__tick" }, h("svg", { class: "icon icon--sm", "aria-hidden": "true" }, h("use", { href: "#i-check" })))
      )
    )
  );
}

/**
 * Mehrfachauswahl fuer Equipment.
 *
 * Der Zustand wird hier lokal gefuehrt und direkt auf der Kachel
 * gespiegelt, statt ueber ein Neuzeichnen. Zwei Gruende: das Ankreuzen ist
 * eine reine Sache des Bildschirms, nicht des Zustands — und wenn jede
 * Auswahl den ganzen Bildschirm neu baut, springt der Fokus beim Tippen.
 */
export function checkGroup({ options, selected, onToggle, name, columns = 2 }) {
  const chosen = new Set(selected);

  return h(
    "div",
    { class: "options", style: { "--cols": columns }, role: "group", "aria-label": name },
    options.map((option) => {
      const on = chosen.has(option.value);

      const tile = h(
        "button",
        {
          type: "button",
          class: `option option--check ${on ? "option--on" : ""}`,
          "aria-pressed": on ? "true" : "false",
        },
        h(
          "span",
          { class: "option__body" },
          h("span", { class: "option__label" }, option.label)
        ),
        h(
          "span",
          { class: "option__tick" },
          h("svg", { class: "icon icon--sm", "aria-hidden": "true" }, h("use", { href: "#i-check" }))
        )
      );

      tile.addEventListener("click", () => {
        const isOn = chosen.has(option.value);
        if (isOn) chosen.delete(option.value);
        else chosen.add(option.value);

        tile.classList.toggle("option--on", !isOn);
        tile.setAttribute("aria-pressed", isOn ? "false" : "true");
        onToggle(Array.from(chosen));
      });

      return tile;
    })
  );
}

/* --------------------------------------------------------------------------
   ANKREUZEN
   -------------------------------------------------------------------------- */

/**
 * Einzelnes Haekchen mit Beschriftung — fuer AGB und Datenschutz.
 *
 * Ein echtes <input type="checkbox"> und kein Knopf: Tastatur, Screenreader
 * und die Merkfunktion des Browsers erwarten genau das. Das Kaestchen ist
 * ein Geschwisterelement, weil ein Ersatzkaestchen kein Eingabefeld
 * ersetzen kann — es zeigt nur, was das Feld darunter sagt.
 *
 * `label` darf ein Knoten sein, damit ein Link mitten im Satz stehen kann;
 * `hint` ist ein erklaerender Zusatz darunter.
 */
export function checkbox({ checked = false, onChange, label, hint, error, id } = {}) {
  const input = h("input", {
    type: "checkbox",
    class: "checkrow__input",
    id,
    checked: checked || null,
    onChange: onChange ? (event) => onChange(event.target.checked) : null,
  });

  return h(
    "div",
    { class: `checkrow ${error ? "checkrow--error" : ""}` },
    h(
      "label",
      { class: "checkrow__label" },
      input,
      h(
        "span",
        { class: "checkrow__box", "aria-hidden": "true" },
        h("svg", { class: "icon icon--sm" }, h("use", { href: "#i-check" }))
      ),
      h(
        "span",
        { class: "checkrow__text" },
        label,
        hint && h("span", { class: "checkrow__hint" }, hint)
      )
    ),
    error && h("p", { class: "field__error" }, error)
  );
}

/* --------------------------------------------------------------------------
   SCHALTER
   -------------------------------------------------------------------------- */

export function toggle({ checked, onChange, label: ariaLabel } = {}) {
  return h("button", {
    type: "button",
    class: "switch",
    role: "switch",
    "aria-checked": checked ? "true" : "false",
    "aria-label": ariaLabel,
    onClick: (event) => {
      const next = event.currentTarget.getAttribute("aria-checked") !== "true";
      event.currentTarget.setAttribute("aria-checked", next ? "true" : "false");
      onChange(next);
    },
  });
}

/* --------------------------------------------------------------------------
   DATUMSFELD
   -------------------------------------------------------------------------- */

export function dateInput({ value, onChange, max, min } = {}) {
  return h("input", {
    type: "date",
    class: "input",
    value: value || "",
    max,
    min,
    onChange: (event) => onChange(event.target.value),
  });
}

/* --------------------------------------------------------------------------
   FOTOAUSWAHL
   -------------------------------------------------------------------------- */

/**
 * Erzeugt ein unsichtbares Dateifeld und ruft `onFiles` mit einer Liste
 * von Dateien auf. Das sichtbare Element ist der Knopf — so kann der
 * Bereich gestaltet werden, ohne dass die Bedienung davon abhaengt.
 */
export function filePicker({ onFiles, multiple = false, accept = "image/*", capture = null, className = "" } = {}) {
  const input = h("input", {
    type: "file",
    accept,
    multiple: multiple || null,
    class: "sr-only",
    capture,
    onChange: (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length && onFiles) onFiles(files);
      /* Zuruecksetzen, damit dieselbe Datei nochmal gewaehlt werden kann. */
      event.target.value = "";
    },
  });

  return { input, trigger: () => input.click() };
}

/* --------------------------------------------------------------------------
   FORTSCHRITT IM FORMULAR
   -------------------------------------------------------------------------- */

export function steps({ current, total, labels = [] }) {
  return h(
    "div",
    {
      class: "steps",
      role: "group",
      "aria-label": `Schritt ${current} von ${total}`,
    },
    Array.from({ length: total }, (unused, index) =>
      h("span", {
        class: `steps__dot ${index + 1 <= current ? "steps__dot--on" : ""} ${
          index + 1 === current ? "steps__dot--now" : ""
        }`,
        title: labels[index] || `Schritt ${index + 1}`,
      })
    )
  );
}
