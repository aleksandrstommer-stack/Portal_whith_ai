"use strict";

/**
 * Strapi при TypeScript читает API из `dist/src/api`, а `tsc` не копирует `schema.json`.
 * Без этого файла контент-типы не регистрируются, и `createCoreRouter` падает с
 * "Cannot read properties of undefined (reading 'kind')".
 */

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const srcApi = path.join(projectRoot, "src", "api");
const distApi = path.join(projectRoot, "dist", "src", "api");

function walkSchemaFiles(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walkSchemaFiles(full, acc);
    } else if (name === "schema.json") {
      acc.push(full);
    }
  }
  return acc;
}

function copySchemas() {
  if (!fs.existsSync(srcApi)) {
    console.warn("[copy-schemas] src/api not found, skip");
    return 0;
  }

  const schemas = walkSchemaFiles(srcApi, []);
  if (schemas.length === 0) {
    console.warn("[copy-schemas] no schema.json under src/api, skip");
    return 0;
  }

  for (const schemaPath of schemas) {
    const rel = path.relative(srcApi, schemaPath);
    const dest = path.join(distApi, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(schemaPath, dest);
  }

  console.log(`[copy-schemas] copied ${schemas.length} schema.json → dist/src/api`);
  return schemas.length;
}

if (require.main === module) {
  copySchemas();
}

module.exports = { copySchemas };
