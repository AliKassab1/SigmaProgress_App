/* ==========================================================================
   SIGMA PROGRESS — components/charts.js
   --------------------------------------------------------------------------
   Diagramme als reines SVG. Kein Chart-Paket: das haette eine eigene
   Abhaengigkeit, eigene Farben und eigene Grundsaetze. Zwei Diagramme
   reichen fuer diesen Prototyp vollstaendig — Linie und Balken.

   Alle Diagramme sind antippenbar: ein Punkt wird gewaehlt und sein Wert
   eingeblendet. Das ist der Unterschied zwischen einem Bild und einem
   Werkzeug.
   ========================================================================== */

import { h } from "../core/dom.js";
import { fmtDate } from "../core/format.js";

const NS_IDS = {
  area: "areaGradient",
  bar: "barGradient",
  ring: "ringGradient",
};

/** Achsenrundung auf eine schoene Spanne. */
function niceScale(min, max, steps = 4) {
  if (min === max) {
    return { low: min - 1, high: max + 1, steps };
  }
  const raw = (max - min) / steps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalised = raw / magnitude;
  const nice = (normalised >= 5 ? 10 : normalised >= 2 ? 5 : normalised >= 1 ? 2 : 1) * magnitude;

  const low = Math.floor(min / nice) * nice;
  const high = Math.ceil(max / nice) * nice;
  return { low, high, step: nice };
}

function linePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

/* --------------------------------------------------------------------------
   LINIENDIAGRAMM — Gewichtsverlauf
   -------------------------------------------------------------------------- */

export function lineChart({
  data,
  height = 168,
  valueKey = "kg",
  format = (value) => String(value),
  selected = null,
  onSelect = null,
  label: ariaLabel = "Verlaufsdiagramm",
  goal = null,
}) {
  const width = 320;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 26;
  const padBottom = 24;

  if (!data || data.length === 0) {
    return emptyChart(height, ariaLabel);
  }

  const values = data.map((item) => item[valueKey]);
  const scale = niceScale(Math.min(...values), Math.max(...values));

  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const x = (index) =>
    padLeft + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value) =>
    padTop + innerHeight - ((value - scale.low) / (scale.high - scale.low)) * innerHeight;

  const points = data.map((item, index) => ({ x: x(index), y: y(item[valueKey]), item }));

  const line = linePath(points);
  const area = `${line} L${points[points.length - 1].x} ${padTop + innerHeight} L${points[0].x} ${padTop + innerHeight} Z`;

  const active = onSelect ? selected : null;
  const activePoint = active !== null ? points.find((point) => point.item.date === active) : null;

  /* Gitter: 3 Linien statt 5 — sonst wirkt das Diagramm lauter als die Daten. */
  const gridLines = [0, 0.5, 1].map((ratio) => padTop + innerHeight * ratio);

  return h(
    "svg",
    {
      class: "chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": ariaLabel,
      style: { overflow: "visible" },
    },
    h(
      "defs",
      null,
      h(
        "linearGradient",
        { id: NS_IDS.area, x1: "0", y1: "0", x2: "0", y2: "1" },
        h("stop", { offset: "0", "stop-color": "var(--green-300)", "stop-opacity": "0.28" }),
        h("stop", { offset: "1", "stop-color": "var(--green-300)", "stop-opacity": "0" })
      )
    ),

    gridLines.map((line2) =>
      h("line", { class: "chart__grid", x1: padLeft, x2: width - padRight, y1: line2, y2: line2 })
    ),

    /* Zielgewicht als Referenzlinie */
    goal !== null &&
      goal >= scale.low &&
      goal <= scale.high &&
      h("line", {
        class: "chart__goal",
        x1: padLeft,
        x2: width - padRight,
        y1: y(goal),
        y2: y(goal),
      }),

    h("path", { d: area, fill: `url(#${NS_IDS.area})` }),
    h("path", { class: "chart__line", d: line }),

    /* Punkte: nur jeder n-te, sonst wird es bei 30 Wochungen unlesbar. */
    points.map((point, index) => {
      const isLast = index === points.length - 1;
      const isSelected = activePoint === point;
      const step = Math.max(1, Math.ceil(points.length / 8));

      if (!isLast && !isSelected && index % step !== 0) return null;

      return h("circle", {
        class: isLast || isSelected ? "chart__dot chart__dot--today" : "chart__dot",
        cx: point.x,
        cy: point.y,
        r: isLast || isSelected ? 4.5 : 3,
      });
    }),

    /* Auswahl: senkrechte Linie plus Werteblaase */
    activePoint &&
      h(
        "g",
        null,
        h("line", {
          class: "chart__cursor",
          x1: activePoint.x,
          x2: activePoint.x,
          y1: padTop - 4,
          y2: padTop + innerHeight,
        }),
        h(
          "g",
          { transform: `translate(${clampBubble(activePoint.x, width)}, ${Math.max(2, activePoint.y - 34)})` },
          h("rect", {
            class: "chart__callout-bg",
            x: -30,
            y: 0,
            width: 60,
            height: 20,
            rx: 8,
          }),
          h(
            "text",
            {
              class: "chart__callout-text",
              x: 0,
              y: 13.5,
              "text-anchor": "middle",
            },
            format(activePoint.item[valueKey])
          )
        )
      ),

    /* Beschriftung: erstes, mittleres, letztes Datum */
    h(
      "text",
      { class: "chart__axis-label", x: padLeft, y: height - 6, "text-anchor": "start" },
      fmtDate(data[0].date)
    ),
    data.length > 2 &&
      h(
        "text",
        {
          class: "chart__axis-label",
          x: width / 2,
          y: height - 6,
          "text-anchor": "middle",
        },
        fmtDate(data[Math.floor(data.length / 2)].date)
      ),
    h(
      "text",
      { class: "chart__axis-label", x: width - padRight, y: height - 6, "text-anchor": "end" },
      fmtDate(data[data.length - 1].date)
    ),

    /* Höchst- und Tiefpunkt links */
    h(
      "text",
      { class: "chart__axis-label", x: padLeft, y: padTop - 10, "text-anchor": "start" },
      format(scale.high)
    ),
    h(
      "text",
      { class: "chart__axis-label", x: padLeft, y: padTop + innerHeight + 12, "text-anchor": "start" },
      format(scale.low)
    ),

    /* Tippen: unsichtbare Trefferflaechen ueber den Punkten */
    onSelect &&
      points.map((point, index) =>
        h("rect", {
          x: point.x - innerWidth / (data.length * 2) - 2,
          y: 0,
          width: innerWidth / data.length + 4,
          height: height,
          fill: "transparent",
          style: { cursor: "pointer" },
          onClick: () => onSelect(data[index].date),
        })
      )
  );
}

function clampBubble(x, width) {
  return Math.max(34, Math.min(width - 34, x));
}

/* --------------------------------------------------------------------------
   BALKENDIAGRAMM — Minuten oder Einheiten je Woche
   -------------------------------------------------------------------------- */

export function barChart({
  data,
  height = 150,
  valueKey = "minutes",
  goal = null,
  format = (value) => String(value),
  selected = null,
  onSelect = null,
  label: ariaLabel = "Balkendiagramm",
}) {
  const width = 320;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 18;
  const padBottom = 24;

  if (!data || data.length === 0) {
    return emptyChart(height, ariaLabel);
  }

  const values = data.map((item) => item[valueKey]);
  const highest = Math.max(...values, goal || 0);
  const scale = niceScale(0, highest, 3);

  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const slot = innerWidth / data.length;
  const barWidth = Math.min(26, slot * 0.58);

  const barY = (value) => padTop + innerHeight - (value / scale.high) * innerHeight;

  return h(
    "svg",
    {
      class: "chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": ariaLabel,
      style: { overflow: "visible" },
    },
    h(
      "defs",
      null,
      h(
        "linearGradient",
        { id: NS_IDS.bar, x1: "0", y1: "0", x2: "0", y2: "1" },
        h("stop", { offset: "0", "stop-color": "var(--green-300)" }),
        h("stop", { offset: "1", "stop-color": "var(--green-600)" })
      )
    ),

    [0, 0.5, 1].map((ratio) =>
      h("line", {
        class: "chart__grid",
        x1: padLeft,
        x2: width - padRight,
        y1: padTop + innerHeight * ratio,
        y2: padTop + innerHeight * ratio,
      })
    ),

    /* Zielmarke */
    goal !== null &&
      goal <= scale.high &&
      h("g", null,
        h("line", {
          class: "chart__goal",
          x1: padLeft,
          x2: width - padRight,
          y1: barY(goal),
          y2: barY(goal),
        }),
        h(
          "text",
          {
            class: "chart__axis-label",
            x: width - padRight,
            y: barY(goal) - 5,
            "text-anchor": "end",
          },
          "Ziel"
        )
      ),

    data.map((item, index) => {
      const centre = padLeft + slot * index + slot / 2;
      const top = barY(item[valueKey]);
      const isSelected = selected === item.start;
      const hit = item[valueKey] >= (goal || Infinity);

      return h(
        "g",
        {
          style: onSelect ? { cursor: "pointer" } : null,
          onClick: onSelect ? () => onSelect(item.start) : null,
        },
        h("rect", {
          class: "chart__bar-track",
          x: centre - barWidth / 2,
          y: padTop,
          width: barWidth,
          height: innerHeight,
          rx: barWidth / 2.6,
        }),
        item[valueKey] > 0 &&
          h("rect", {
            class: `chart__bar ${hit ? "chart__bar--done" : ""} ${isSelected ? "chart__bar--done" : ""}`,
            x: centre - barWidth / 2,
            y: top,
            width: barWidth,
            height: Math.max(3, padTop + innerHeight - top),
            rx: barWidth / 2.6,
          }),
        h(
          "text",
          {
            class: "chart__axis-label",
            x: centre,
            y: height - 7,
            "text-anchor": "middle",
          },
          item.label
        ),
        (isSelected || data.length <= 8) &&
          item[valueKey] > 0 &&
          h(
            "text",
            {
              class: "chart__value-label",
              x: centre,
              y: top - 6,
              "text-anchor": "middle",
            },
            format(item[valueKey])
          )
      );
    })
  );
}

/* --------------------------------------------------------------------------
   MINIDIAGRAMM — fuer Karten und Listenzeilen
   -------------------------------------------------------------------------- */

export function sparkline(values, { width = 72, height = 26, valueKey = null } = {}) {
  if (!values || values.length < 2) return null;

  const numbers = valueKey ? values.map((item) => item[valueKey]) : values;
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const span = max - min || 1;

  const points = numbers.map((value, index) => ({
    x: (index / (numbers.length - 1)) * width,
    y: height - 2 - ((value - min) / span) * (height - 4),
  }));

  return h(
    "svg",
    { width, height, viewBox: `0 0 ${width} ${height}`, class: "sparkline", "aria-hidden": "true" },
    h("path", {
      d: linePath(points),
      fill: "none",
      stroke: "var(--green-300)",
      "stroke-width": 1.75,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
}

/* --------------------------------------------------------------------------
   TAGESBALKEN — Schritte der letzten Tage
   -------------------------------------------------------------------------- */

export function dayBars(data, { height = 56, goal = 8000 } = {}) {
  if (!data || !data.length) return null;

  const max = Math.max(...data.map((item) => item.count), goal);
  const width = 300;
  const slot = width / data.length;
  const barWidth = Math.min(22, slot * 0.5);

  return h(
    "svg",
    {
      class: "chart",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Schritte der letzten Tage",
      style: { overflow: "visible" },
    },
    data.map((item, index) => {
      const centre = slot * index + slot / 2;
      const barHeight = Math.max(3, (item.count / max) * (height - 18));
      const hit = item.count >= goal;

      return h(
        "g",
        null,
        h("rect", {
          class: "chart__bar-track",
          x: centre - barWidth / 2,
          y: 2,
          width: barWidth,
          height: height - 18,
          rx: barWidth / 2.6,
        }),
        h("rect", {
          class: `chart__bar ${hit ? "chart__bar--done" : ""}`,
          x: centre - barWidth / 2,
          y: height - 16 - barHeight,
          width: barWidth,
          height: barHeight,
          rx: barWidth / 2.6,
        }),
        h(
          "text",
          {
            class: "chart__axis-label",
            x: centre,
            y: height - 3,
            "text-anchor": "middle",
          },
          item.label
        )
      );
    })
  );
}

/* --------------------------------------------------------------------------
   LEERZUSTAND
   -------------------------------------------------------------------------- */

function emptyChart(height, ariaLabel) {
  return h(
    "svg",
    {
      class: "chart",
      viewBox: `0 0 320 ${height}`,
      role: "img",
      "aria-label": `${ariaLabel}: noch keine Daten`,
    },
    h("rect", {
      x: 8,
      y: 20,
      width: 304,
      height: height - 48,
      rx: 12,
      fill: "rgba(255,255,255,0.025)",
    }),
    h(
      "text",
      {
        class: "chart__axis-label",
        x: 160,
        y: height / 2 + 4,
        "text-anchor": "middle",
      },
      "Noch keine Daten"
    )
  );
}
