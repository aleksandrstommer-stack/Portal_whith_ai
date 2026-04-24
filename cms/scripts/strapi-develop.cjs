"use strict";

/**
 * Обёртка над `strapi develop`: после каждой пересборки TS в `dist/` снова копируем
 * `schema.json`, т.к. `tsc` их не эмитит (см. scripts/copy-schemas.cjs).
 */

const { spawn } = require("child_process");
const path = require("path");

const { copySchemas } = require("./copy-schemas.cjs");

const copy = () => {
  try {
    copySchemas();
  } catch (e) {
    console.error("[strapi-develop] copy-schemas failed:", e.message);
  }
};

copy();

const strapiCli = path.join(__dirname, "..", "node_modules", "@strapi", "strapi", "bin", "strapi.js");
const child = spawn(process.execPath, [strapiCli, "develop"], {
  stdio: "inherit",
  env: process.env,
  cwd: path.join(__dirname, ".."),
});

const interval = setInterval(copy, 2500);

child.on("exit", (code, signal) => {
  clearInterval(interval);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
