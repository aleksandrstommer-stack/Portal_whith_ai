"use strict";

/**
 * Сброс кэша сборки админки Strapi (webpack / .strapi).
 * После этого при следующем `strapi develop` подтянется src/admin/app.tsx (локали, bootstrap).
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const targets = [path.join(root, ".strapi"), path.join(root, "dist", "build")];

for (const p of targets) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log("[clean-admin-cache] removed", p);
  } else {
    console.log("[clean-admin-cache] skip (нет папки)", p);
  }
}
