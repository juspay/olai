import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import { expect, test } from "bun:test";

import { BUNDLE_NAMES as PLUGIN_NAMES, ROWS } from "@olai/bundle";

import { ROOT } from "./support/sweep.ts";

import {
  at,
  authored,
  INDEX,
  isLocal,
  landing,
  linksIn,
  pages,
  served,
  VAULT,
} from "./support/docs.ts";

test("the registry is actually being read", () => {
  expect(PLUGIN_NAMES.length).toBeGreaterThan(0);
});

test("every plugin's page sits in the plugin's own package, and has a title", () => {
  const wrong = PLUGIN_NAMES.flatMap((name) => {
    const file = authored(name);
    if (!fs.existsSync(at(file))) return [`${file}: no such file`];
    const heading = fs.readFileSync(at(file), "utf8").split("\n")[0] ?? "";
    return heading.startsWith("# ") ? [] : [`${file}: opens with ${heading}, not a heading`];
  });
  expect(wrong).toEqual([]);
});

test("the served page is a SYMLINK onto it, never a copy", () => {
  const wrong = PLUGIN_NAMES.flatMap((name) => {
    const link = served(name);
    if (!fs.existsSync(at(link))) return [`${link}: no such file`];
    if (!fs.lstatSync(at(link)).isSymbolicLink()) {
      return [`${link}: a real file — it must be a symlink onto ${authored(name)}`];
    }
    const target = path.relative(ROOT, fs.realpathSync(at(link)));
    return target === authored(name) ? [] : [`${link}: resolves to ${target}, not ${authored(name)}`];
  });
  expect(wrong).toEqual([]);
});

test("the served set holds a page per plugin and no orphan", () => {
  expect(fs.readdirSync(at(path.join(VAULT, "plugins"))).sort())
    .toEqual(PLUGIN_NAMES.map((name) => path.basename(served(name))).sort());
});

test("every link on a plugin's page is a door at the address it is served from", () => {
  const broken = PLUGIN_NAMES.flatMap((name) => {
    const page = served(name);
    return linksIn(page).filter(isLocal).flatMap((target) => {
      const landed = landing(page, target);
      if (landed === null) return [`${page}: ${target} leaves ${VAULT}/, so it is not a door`];
      return fs.existsSync(at(landed)) ? [] : [`${page}: ${target} → ${landed}, which is not there`];
    });
  });
  expect(broken).toEqual([]);
});

test("the index links every plugin's page, and no page it does not have", () => {
  const listed = linksIn(INDEX)
    .filter((target) => target.startsWith("plugins/"))
    .map((target) => path.join(VAULT, target));
  expect([...new Set(listed)].sort()).toEqual(PLUGIN_NAMES.map((name) => served(name)).sort());
});

test("the index says something about each plugin, and not only its name", () => {
  const rows = fs.readFileSync(at(INDEX), "utf8").split("\n");
  const thin = PLUGIN_NAMES.flatMap((name) => {
    const line = rows.find((row) => row.includes(`](plugins/${name}.md)`));
    if (line === undefined) return [`${name}: no line in ${INDEX}`];
    const after = line.slice(line.indexOf(`](plugins/${name}.md)`) + `](plugins/${name}.md)`.length);
    return after.trim().length > 40 ? [] : [`${name}: the line in ${INDEX} is a link and no gloss`];
  });
  expect(thin).toEqual([]);
});

test("every page the index links is a page that is there", () => {
  const broken = linksIn(INDEX).filter(isLocal).flatMap((target) => {
    const landed = landing(INDEX, target);
    if (landed === null) return [];
    return fs.existsSync(at(landed)) ? [] : [`${INDEX}: ${target} → ${landed}, which is not there`];
  });
  expect(broken).toEqual([]);
});


test("every environment door declared by a row is named on some page", async () => {
  const written = pages()
    .map((page) => fs.readFileSync(at(page), "utf8"))
    .join("\n")
  for (const row of ROWS) {
    if (row.browserOnly) continue
    const module = await import(createRequire(at("packages/bundle/package.json")).resolve(row.name))
    for (const door of module.default.environment ?? []) {
      expect(written, `${row.id}: ${door.key}`).toContain(door.key)
    }
  }
})
