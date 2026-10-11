/* ==========================================================================
   SIGMA PROGRESS — core/dom.js
   --------------------------------------------------------------------------
   Minimaler DOM-Baukasten. Bewusst kein Framework: die App braucht nur
   "Element bauen", "Kinder anhängen", "leeren". Alles andere wäre Overhead.

   Bewusst KEIN innerHTML — SVG wird ueber den echten Namespace gebaut, damit
   Gradients und <use> zuverlaessig funktionieren.
   ========================================================================== */

const SVG_NS = "http://www.w3.org/2000/svg";

const SVG_TAGS = new Set([
  "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon",
  "text", "tspan", "defs", "use", "ellipse", "title",
  "linearGradient", "radialGradient", "stop", "clipPath",
]);

/* Attribute, die als Property gesetzt werden muessen, weil setAttribute
   bei ihnen nicht funktioniert bzw. den Zustand nicht spiegelt. */
const PROPS = new Set(["value", "checked", "indeterminate", "disabled", "selected"]);

/**
 * h("div", { class: "card", onclick: fn }, "Text", child)
 *
 * props:
 *   class, id, href, type, ...   normale Attribute
 *   style: { … }                 Objektform
 *   dataset: { … }               data-Attribute
 *   on<typ>: fn                  Ereignis (onclick, oninput, …)
 *   value/checked/disabled/…     als Property
 *   true                         Attribute ohne Wert setzen
 */
export function h(tag, props, ...children) {
  /* Ein Element an der Stelle von `tag` ist ein Tippfehler wie `h(Icon(...))`
     statt `Icon(...)`. Ohne diese Pruefung meldet der Browser nur
     "invalid tag name" und man sucht den Fehler im falschen Screen. */
  if (typeof tag !== "string") {
    throw new TypeError(`h() erwartet einen Tag-Namen, bekam ${typeof tag}.`);
  }

  const el = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (props) {
    for (const key of Object.keys(props)) {
      const value = props[key];

      if (value === null || value === undefined || value === false) continue;

      if (key === "class") {
        el.setAttribute("class", Array.isArray(value) ? value.filter(Boolean).join(" ") : value);
      } else if (key === "style" && typeof value === "object") {
        for (const prop of Object.keys(value)) {
          if (value[prop] === null || value[prop] === undefined) continue;
          if (prop.startsWith("--")) el.style.setProperty(prop, String(value[prop]));
          else el.style[prop] = value[prop];
        }
      } else if (key === "dataset") {
        for (const prop of Object.keys(value)) {
          if (value[prop] === null || value[prop] === undefined) continue;
          el.dataset[prop] = String(value[prop]);
        }
      } else if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (PROPS.has(key)) {
        el[key] = value;
      } else if (value === true) {
        el.setAttribute(key, "");
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }

  append(el, children);
  return el;
}

/** Textknoten — haelt Text immer von Markup getrennt. */
export function text(value) {
  return document.createTextNode(String(value));
}

/** Unsichtbarer Platzhalter, damit `.map()` nichts liefern kann. */
export function nothing() {
  return document.createComment("spacer");
}

/** Kinder anhaengen; Knoten, Strings, Zahlen, Arrays und null sind erlaubt. */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(
      child instanceof Node ? child : document.createTextNode(String(child))
    );
  }
  return parent;
}

/** Dokumentfragment — haengt Kinder an, ohne zusaetzliche Ebene im DOM. */
export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

/** Knoten leeren, ohne die Referenz zu verlieren (z.B. fuer den Viewport). */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Kinder austauschen. */
export function replace(node, ...children) {
  return append(clear(node), children);
}

export function on(node, type, handler, options) {
  node.addEventListener(type, handler, options);
  return () => node.removeEventListener(type, handler, options);
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Ereignisdelegation: ein Listener am Elternknoten statt N an den Kindern.
 * Wichtig fuer Listen, die bei jedem Rendern neu gebaut werden.
 */
export function delegate(root, selector, type, handler) {
  root.addEventListener(type, (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler(event, target);
  });
}

/* --------------------------------------------------------------------------
   SVG-Hilfen
   -------------------------------------------------------------------------- */

/** viewBox-SVG mit gemeinsamen Defaults. */
export function svg(viewBox, attrs, ...children) {
  return h("svg", { viewBox, fill: "none", ...attrs }, ...children);
}

/** SVG-<use> auf einen Symbol-Sprite. */
export function use(href, className = "icon") {
  return h("svg", { class: className, "aria-hidden": "true" }, h("use", { href }));
}

/* --------------------------------------------------------------------------
   Bild-Hilfen
   -------------------------------------------------------------------------- */

/** Datei -> Data-URL. Fuer Fotos noetig, weil localStorage nur Strings haelt. */
export function readImage(file, maxWidth = 1000) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Bitte eine Bilddatei waehlen."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.onload = () => {
      const dataUrl = String(reader.result);

      /* Fotos ungetestet in localStorage zu legen sprengt das 5-MB-Limit
         sofort. Deshalb wird vor dem Speichern herunterskaliert. */
      const image = new Image();
      image.onerror = () => reject(new Error("Das Bild konnte nicht verarbeitet werden."));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        if (scale === 1) {
          resolve({ src: dataUrl, bytes: dataUrl.length });
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ src: canvas.toDataURL("image/jpeg", 0.72), bytes: 0 });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
