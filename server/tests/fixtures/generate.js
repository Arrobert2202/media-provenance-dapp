"use strict";

const fs   = require("fs");
const path = require("path");

const FIXTURES_DIR = path.join(__dirname);

const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

function createFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  const files = ["original.jpg", "compressed.jpg", "unrelated.jpg"];
  files.forEach((name) => {
    fs.writeFileSync(path.join(FIXTURES_DIR, name), MINIMAL_JPEG);
  });

  return {
    originalPath  : path.join(FIXTURES_DIR, "original.jpg"),
    compressedPath: path.join(FIXTURES_DIR, "compressed.jpg"),
    unrelatedPath : path.join(FIXTURES_DIR, "unrelated.jpg"),
  };
}

function cleanFixtures() {
  ["original.jpg", "compressed.jpg", "unrelated.jpg"].forEach((name) => {
    const p = path.join(FIXTURES_DIR, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

module.exports = { createFixtures, cleanFixtures };
