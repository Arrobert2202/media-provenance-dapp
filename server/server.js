"use strict";

const express   = require("express");
const cors      = require("cors");
const multer    = require("multer");
const path      = require("path");
const fs        = require("fs");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname) || ".jpg"}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only image files are accepted (JPEG, PNG, WEBP, BMP, TIFF)."), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

const registry = new Map();

const SEED_PHASH = "demo_phash_replace_with_real_value";
registry.set(SEED_PHASH, {
  phash    : SEED_PHASH,
  author   : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  timestamp: Math.floor(Date.now() / 1000) - 3600,
  context  : "Protest in Piața Victoriei, Bucharest — 01/05/2026 18:30",
});

function computePHash(imagePath) {
  return new Promise((resolve, reject) => {
    const scriptDir  = path.resolve(__dirname, "..");
    const pythonCode = [
      "import sys",
      `sys.path.insert(0, r'${scriptDir}')`,
      "from phash_generator import compute_phash",
      `print(compute_phash(r'${imagePath}'))`,
    ].join("; ");

    const pythonBin = process.platform === "win32" ? "python" : "python3";
    const child = spawn(pythonBin, ["-c", pythonCode]);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Python exited ${code}.\n${stderr.trim()}`));
      const phash = stdout.trim();
      if (!phash) return reject(new Error("Python returned an empty pHash."));
      resolve(phash);
    });

    child.on("error", (err) => reject(new Error(`Failed to spawn Python: ${err.message}`)));
  });
}

function hammingDistance(hexA, hexB) {
  if (hexA.length !== hexB.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hexA.length; i++) {
    const xor = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    distance += xor.toString(2).split("").filter((b) => b === "1").length;
  }
  return distance;
}

function findSimilarRecord(queryHash, threshold = 10) {
  let bestMatch = null;
  let bestDist  = Infinity;

  for (const [storedHash, record] of registry.entries()) {
    if (storedHash === SEED_PHASH) continue;
    const dist = hammingDistance(queryHash, storedHash);
    if (dist <= threshold && dist < bestDist) {
      bestDist  = dist;
      bestMatch = { record, distance: dist };
    }
  }
  return bestMatch;
}

function deleteTempFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) console.warn(`[cleanup] Could not delete: ${filePath}`);
  });
}

app.post("/api/anchor", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No image file provided." });
  }

  const { context, author } = req.body;

  if (!context || context.trim() === "") {
    deleteTempFile(req.file.path);
    return res.status(400).json({ success: false, error: "Context field is required." });
  }

  const walletAddress = author?.trim() || `0x${uuidv4().replace(/-/g, "").slice(0, 40)}`;

  try {
    console.log(`[anchor] ${req.file.originalname}`);
    const phash = await computePHash(req.file.path);

    if (registry.has(phash)) {
      deleteTempFile(req.file.path);
      const existing = registry.get(phash);
      return res.status(409).json({
        success  : false,
        duplicate: true,
        error    : "This image (or a visually identical one) is already registered.",
        existing : { phash: existing.phash, author: existing.author, timestamp: existing.timestamp, context: existing.context },
      });
    }

    const timestamp   = Math.floor(Date.now() / 1000);
    const txHash      = "0x" + Buffer.from(uuidv4().replace(/-/g, ""), "hex").toString("hex").padEnd(64, "0");
    const blockNumber = Math.floor(Math.random() * 1_000_000) + 19_000_000;

    registry.set(phash, { phash, author: walletAddress, timestamp, context: context.trim() });

    deleteTempFile(req.file.path);
    return res.status(201).json({
      success: true, phash, author: walletAddress, timestamp,
      context: context.trim(), txHash, blockNumber, duplicate: false,
    });
  } catch (err) {
    console.error("[anchor]", err.message);
    deleteTempFile(req.file.path);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/verify", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No image file provided." });
  }

  try {
    console.log(`[verify] ${req.file.originalname}`);
    const phash = await computePHash(req.file.path);

    if (registry.has(phash)) {
      const record = registry.get(phash);
      deleteTempFile(req.file.path);
      return res.status(200).json({ success: true, verified: true, phash, distance: 0, record });
    }

    const match = findSimilarRecord(phash);
    deleteTempFile(req.file.path);

    if (match) {
      return res.status(200).json({
        success: true, verified: true, phash,
        distance: match.distance, record: match.record,
      });
    }

    return res.status(200).json({ success: true, verified: false, phash, distance: null, record: null });
  } catch (err) {
    console.error("[verify]", err.message);
    deleteTempFile(req.file.path);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", registrySize: registry.size });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error("[error]", err.message);
  res.status(400).json({ success: false, error: err.message });
});

module.exports = { app, registry };

if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
}
