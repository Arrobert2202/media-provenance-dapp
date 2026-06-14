"use strict";

const express   = require("express");
const cors      = require("cors");
const multer    = require("multer");
const path      = require("path");
const fs        = require("fs");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const { ethers } = require("ethers");

const RPC_URL          = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PRIVATE_KEY      = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const artifactPath = path.resolve(__dirname, "..", "artifacts", "contracts", "ImageRegistry.sol", "ImageRegistry.json");
const { abi: CONTRACT_ABI } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

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
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff", "application/pdf"];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only image files (JPEG, PNG, WEBP, BMP, TIFF) and PDFs are accepted."), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });


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
      // phash_generator prints debug lines; the actual hash is always the last line
      const lines = stdout.trim().split("\n").filter(l => l.length > 0);
      const phash = lines[lines.length - 1].trim();
      if (!phash) return reject(new Error("Python returned an empty pHash."));
      resolve(phash);
    });

    child.on("error", (err) => reject(new Error(`Failed to spawn Python: ${err.message}`)));
  });
}

// compute hamming distance for a single hex hash pair
function singleHamming(hexA, hexB) {
  if (hexA.length !== hexB.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < hexA.length; i++) {
    const xor = parseInt(hexA[i], 16) ^ parseInt(hexB[i], 16);
    dist += xor.toString(2).split("").filter((b) => b === "1").length;
  }
  return dist;
}

// compute dual hamming distance
// format: "phash|dhash" per page, pages separated by ":"
// returns max(phash_dist, dhash_dist) across all pages
function hammingDistance(hashA, hashB) {
  const pagesA = hashA.split(":");
  const pagesB = hashB.split(":");

  if (pagesA.length !== pagesB.length) return Infinity;

  let maxDist = 0;
  for (let p = 0; p < pagesA.length; p++) {
    const partsA = pagesA[p].split("|");
    const partsB = pagesB[p].split("|");

    let pageDist;
    if (partsA.length === 2 && partsB.length === 2) {
      // dual hash: max of phash distance and dhash distance
      const phDist = singleHamming(partsA[0], partsB[0]);
      const dhDist = singleHamming(partsA[1], partsB[1]);
      pageDist = Math.max(phDist, dhDist);
    } else if (partsA.length === 1 && partsB.length === 1) {
      // legacy single hash
      pageDist = singleHamming(partsA[0], partsB[0]);
    } else {
      return Infinity;
    }

    if (pageDist > maxDist) maxDist = pageDist;
  }
  return maxDist;
}

function cleanup(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) console.warn(`[cleanup] ${filePath}`);
  });
}

app.post("/api/anchor", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file provided." });
  }

  const { context } = req.body;

  if (!context || context.trim() === "") {
    cleanup(req.file.path);
    return res.status(400).json({ success: false, error: "Context field is required." });
  }

  try {
    console.log(`[anchor] ${req.file.originalname}`);
    const phash = await computePHash(req.file.path);

    const alreadyAnchored = await contract.hasBeenAnchored(phash);
    if (alreadyAnchored) {
      cleanup(req.file.path);
      const allRecords = await contract.getAllRecords();
      const existing = allRecords.find((r) => r.dualHash === phash);
      return res.status(409).json({
        success  : false,
        duplicate: true,
        error    : "This file (or a visually identical one) is already registered.",
        existing : existing
          ? { dualHash: existing.dualHash, author: existing.author, timestamp: Number(existing.timestamp), context: existing.context }
          : null,
      });
    }

    // Anchor on-chain
    const tx = await contract.anchorImage(phash, context.trim());    const receipt = await tx.wait();

    cleanup(req.file.path);
    return res.status(201).json({
      success    : true,
      dualHash   : phash,
      author     : signer.address,
      timestamp  : Math.floor(Date.now() / 1000),
      context    : context.trim(),
      txHash     : receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      duplicate  : false,
    });
  } catch (err) {
    console.error("[anchor]", err.message);
    cleanup(req.file.path);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/verify", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file provided." });
  }

  try {
    console.log(`[verify] ${req.file.originalname}`);
    const phash = await computePHash(req.file.path);

    const allRecords = await contract.getAllRecords();

    let bestMatch = null;
    let bestDist  = Infinity;

    for (const record of allRecords) {
      const dist = hammingDistance(phash, record.dualHash);
      if (dist <= 10 && dist < bestDist) {
        bestDist  = dist;
        bestMatch = {
          dualHash : record.dualHash,
          author   : record.author,
          timestamp: Number(record.timestamp),
          context  : record.context,
        };
      }
    }

    cleanup(req.file.path);

    if (bestMatch) {
      return res.status(200).json({
        success : true,
        verified: true,
        dualHash: phash,
        distance: bestDist,
        record  : bestMatch,
      });
    }

    return res.status(200).json({ success: true, verified: false, dualHash: phash, distance: null, record: null });
  } catch (err) {
    console.error("[verify]", err.message);
    cleanup(req.file.path);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const count = await contract.getRecordCount();
    res.json({ status: "ok", registrySize: Number(count) });
  } catch (err) {
    res.json({ status: "degraded", error: err.message, registrySize: 0 });
  }
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error("[error]", err.message);
  res.status(400).json({ success: false, error: err.message });
});

module.exports = { app };

if (require.main === module) {
  app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
}
