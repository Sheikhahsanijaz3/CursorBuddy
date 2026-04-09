#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

// Simple build: copy src/cli.js to dist/cli.js with shebang
const src = fs.readFileSync(path.join(__dirname, "src/cli.js"), "utf-8");
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist/cli.js"), src);
fs.chmodSync(path.join(__dirname, "dist/cli.js"), 0o755);
console.log("Built dist/cli.js");
