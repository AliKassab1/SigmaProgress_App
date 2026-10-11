/* ==========================================================================
   SIGMA PROGRESS — scripts/check.cjs
   --------------------------------------------------------------------------
   Vier statische Pruefungen ueber pwa/js. Ohne Build-Schritt sind das die
   einzigen Wächter, die es gibt — und sie haben schon echte Fehler gefunden,
   die erst zur Laufzeit sichtbar wurden:

     1. PARSE      Syntaxfehler (`node --check` schlupft bei ES-Modulen durch)
     2. IMPORTS    importierte Namen, die das Zielmodul nicht exportiert,
                   sowie unbenutzte Importe
     3. SCOPE      Bezeichner, die weder importiert noch gebunden sind
                   — der Fall, der beim ersten Screen-Besuch abstuerzt
     4. h() TAG    Aufrufe, deren erstes Argument kein Tag-String ist;
                   `h(Icon(...))` erzeugt ein `<[object Object]>`

   Aufruf:  node pwa/scripts/check.cjs
   Exitcode 1, sobald etwas gefunden wurde.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const ROOT = path.resolve(__dirname, "..", "js");

/* Browser- und JS-Standardnamen, die es in keinem Modul zu binden gibt. */
const GLOBALS = new Set([
  "AbortController", "Array", "Boolean", "CSS", "CustomEvent", "Date", "Document",
  "Element", "Error", "Event", "FileReader", "FormData", "Headers", "Image", "Infinity",
  "Intl", "IntersectionObserver", "JSON", "Map", "Math", "Node", "Notification",
  "Number", "Object", "Promise", "Request", "ResizeObserver", "Response", "Set",
  "String", "TextDecoder", "TextEncoder", "TypeError", "URL", "Blob", "alert",
  "atob", "btoa", "cancelAnimationFrame", "clearInterval", "clearTimeout",
  "confirm", "console", "crypto", "decodeURIComponent", "document",
  "encodeURIComponent", "fetch", "globalThis", "history", "isFinite", "isNaN",
  "localStorage", "location", "matchMedia", "navigator", "parseFloat", "parseInt",
  "performance", "queueMicrotask", "requestAnimationFrame", "setInterval",
  "setTimeout", "structuredClone", "Uint8Array", "undefined", "window",
]);

/* Nur `h` erwartet an erster Stelle einen Tag-Namen. `svg` nimmt einen
   viewBox, `append`/`replace` einen Knoten — dort ist ein Objekt richtig. */
const FACTORY_TAGS = new Set(["h"]);

const files = [];
(function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
})(ROOT);

const rel = (file) => path.relative(ROOT, file);
const parse = (file) =>
  acorn.parse(fs.readFileSync(file, "utf8"), {
    ecmaVersion: "latest",
    sourceType: "module",
    locations: true,
  });

/* Tiefensuche ueber den Baum, inklusive Array-Knoten. */
function each(node, visit, parent = null) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) each(child, visit, parent);
    return;
  }
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
    each(node[key], visit, node);
  }
}

/* Muster koennen Identifier, ObjectPattern, ArrayPattern, RestElement oder
   Default-Zuweisung sein — deshalb rekursiv. */
function patternNames(pattern, into) {
  if (!pattern) return;
  if (pattern.type === "Identifier") into.add(pattern.name);
  else each(pattern, (node) => { if (node.type === "Identifier") into.add(node.name); });
}

let failures = 0;
const fail = (message) => { failures++; console.log("  " + message); };

/* --- 1. PARSE ------------------------------------------------------------ */

const parsed = new Map();

console.log("1  Syntax");
for (const file of files) {
  try {
    parsed.set(file, parse(file));
  } catch (error) {
    fail(`${rel(file)}  ${error.message}`);
  }
}
if (parsed.size === files.length) console.log("   ok — alle Module lesbar");

/* --- 2. IMPORTS ---------------------------------------------------------- */

/* Exportierte Namen je Modul. */
const exportsOf = new Map();
for (const [file, ast] of parsed) {
  const names = new Set();
  for (const node of ast.body) {
    if (node.type !== "ExportNamedDeclaration") continue;
    if (node.declaration) {
      const declaration = node.declaration;
      if (declaration.id) names.add(declaration.id.name);
      for (const item of declaration.declarations || []) names.add(item.id.name);
    }
    for (const specifier of node.specifiers || []) names.add(specifier.exported.name);
  }
  exportsOf.set(path.resolve(file), names);
}

console.log("2  Importe");
let importProblems = 0;
for (const [file, ast] of parsed) {
  const source = fs.readFileSync(file, "utf8");
  const body = source.replace(/^import[\s\S]*?from\s*"[^"]+";$/gm, "");
  const used = [];

  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration") continue;
    if (!node.source.value.startsWith(".")) continue;

    const target = path.resolve(path.dirname(file), node.source.value);
    const available = exportsOf.get(target);

    if (!available) {
      importProblems++;
      fail(`${rel(file)}  Modul fehlt: ${node.source.value}`);
      continue;
    }

    for (const specifier of node.specifiers) {
      if (specifier.type !== "ImportSpecifier") continue;
      const name = specifier.imported.name;
      if (!available.has(name)) {
        importProblems++;
        fail(`${rel(file)}  "${name}" wird von ${path.relative(ROOT, target)} nicht exportiert`);
      }
      used.push(specifier.local.name);
    }
  }

  for (const name of used) {
    const pattern = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`);
    if (!pattern.test(body)) fail(`${rel(file)}  unbenutzter Import: ${name}`);
  }
}
if (importProblems === 0) console.log("   ok — jede Importliste passt");

/* --- 3. SCOPE ------------------------------------------------------------ */

console.log("3  Ungebundene Bezeichner");

/* Alle Namen, die irgendwo im Modul gebunden werden: Importe, Parameter,
   Destrukturierung, Catch, Deklarationen, benannte Funktionsausdruecke. */
function bindings(ast) {
  const names = new Set();

  each(ast, (node) => {
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) names.add(specifier.local.name);
    } else if (node.type === "VariableDeclarator") {
      patternNames(node.id, names);
    } else if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
      if (node.id) names.add(node.id.name);
      for (const param of node.params || []) patternNames(param, names);
    } else if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
      if (node.id) names.add(node.id.name);
      for (const param of node.params || []) patternNames(param, names);
    } else if (node.type === "CatchClause") {
      patternNames(node.param, names);
    }
  });

  return names;
}

let scopeProblems = 0;
for (const [file, ast] of parsed) {
  const declared = bindings(ast);
  const undeclared = new Map();

  each(ast, (node, parent) => {
    if (node.type !== "Identifier") return;
    /* Object-Schluessel, Member-Namen und Labels sind keine Referenzen. */
    if (parent && parent.type === "MemberExpression" && parent.property === node && !parent.computed) return;
    if (parent && parent.type === "Property" && parent.key === node && !parent.computed) return;
    if (parent && parent.type === "LabeledStatement" && parent.label === node) return;
    if (parent && (parent.type === "BreakStatement" || parent.type === "ContinueStatement")) return;
    if (declared.has(node.name) || GLOBALS.has(node.name)) return;
    if (!undeclared.has(node.name)) undeclared.set(node.name, node.loc.start.line);
  });

  for (const [name, line] of undeclared) {
    scopeProblems++;
    fail(`${rel(file)}:${line}  ${name}`);
  }
}
if (scopeProblems === 0) console.log("   ok — nichts benutzt, was nicht existiert");

/* --- 4. h() TAG ---------------------------------------------------------- */

console.log("4  h() Tag-Argument");
let tagProblems = 0;
for (const [file, ast] of parsed) {
  const source = fs.readFileSync(file, "utf8");
  each(ast, (node) => {
    if (node.type !== "CallExpression") return;
    if (node.callee.type !== "Identifier" || !FACTORY_TAGS.has(node.callee.name)) return;
    const first = node.arguments[0];
    if (!first) return;
    if (first.type === "Literal" && typeof first.value === "string") return;

    tagProblems++;
    const snippet = source.slice(first.start, first.end).replace(/\s+/g, " ").slice(0, 60);
    fail(`${rel(file)}  h(<${first.type}: ${snippet}>)`);
  });
}
if (tagProblems === 0) console.log("   ok — jeder h()-Aufruf hat ein Tag");

/* --- Ergebnis ------------------------------------------------------------ */

if (failures === 0) {
  console.log(`\nAlles sauber (${files.length} Module).`);
} else {
  console.log(`\n${failures} Befund(e).`);
}

process.exit(failures === 0 ? 0 : 1);