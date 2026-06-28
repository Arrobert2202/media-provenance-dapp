# ImageTrace — Decentralised Image Traceability

A proof-of-concept system that lets journalists anchor a **dual perceptual hash (pHash + dHash)** of an original photograph on the Ethereum blockchain. Anyone can later upload a potentially compressed or re-shared version of that image and verify whether it matches a registered original — even after lossy re-compression (e.g. WhatsApp, social media).

---

## How It Works

1. A journalist uploads an image and metadata (date, location, description).
2. A **dual perceptual hash** is computed — pHash (DCT-based, captures structure) + dHash (gradient-based, captures brightness relationships).
3. The 129-character hash string is stored permanently in the `ImageRegistry` smart contract on-chain.
4. To verify, anyone uploads a suspicious image. The system computes its hash and compares it to every registered record using the **Hamming distance** (bit-by-bit XOR).
5. The verdict is determined by the maximum of the two distances (pHash and dHash):
   - **≤ 10 bits** → Match (green card) — verified source
   - **11–20 bits** → Uncertain (yellow card) — similar but inconclusive
   - **> 20 bits** → No match (red card) — unknown origin

---

## Project Structure

```
├── contracts/            # Solidity smart contract (ImageRegistry.sol)
├── ignition/             # Hardhat Ignition deploy module
├── client/               # React frontend (Vite + Tailwind)
├── server/               # Node.js / Express API backend
├── phash_generator.py    # Python dual-hash engine (pHash + dHash)
├── scripts/              # Deployment and experiment scripts
│   ├── deploy.js         # Contract deployment script
│   ├── gas_experiments.cjs   # Gas cost measurements
│   ├── phash_experiments.py  # Perceptual hash experiments
│   └── run-experiments.sh    # Full experiment suite runner
├── experiments/          # Experiment results (generated)
├── test_corpus/          # Test images and PDFs
└── hardhat.config.js     # Hardhat configuration
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.9 |
| Poppler | Any recent version (for PDF support) |

---

## Setup

### 1. Python dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install Pillow imagehash pdf2image
```

> Note: On macOS (Homebrew), installing packages globally is blocked — a virtual environment is required.
> Remember to activate it (`source venv/bin/activate`) each time you open a new terminal.

> `pdf2image` requires Poppler to be installed on your system:
> - macOS: `brew install poppler`
> - Ubuntu: `sudo apt install poppler-utils`

### 2. Root (Hardhat) dependencies

```bash
npm install
```

### 3. Server dependencies

```bash
cd server
npm install
```

### 4. Client dependencies

```bash
cd client
npm install
```

---

## Running the Project

All four steps below need to run simultaneously. Open a separate terminal for each.

### Step 1 — Start the local Ethereum node

```bash
npx hardhat node
```

Starts a local blockchain at `http://127.0.0.1:8545` with automining enabled.

### Step 2 — Deploy the smart contract

```bash
npx hardhat ignition deploy ignition/modules/ImageRegistry.js --network localhost
```

The deployed contract address defaults to `0x5FbDB2315678afecb367f032d93F642f64180aa3` on a fresh node.

### Step 3 — Start the API server

```bash
cd server
npm start
```

The Express server starts on `http://localhost:3001`.

### Step 4 — Start the React frontend

```bash
cd client
npm run dev
```

The UI is available at `http://localhost:5173`.

---

## Running the Experiments

The full experiment suite (pHash tests, gas measurements, Slither audit) can be reproduced with a single command:

```bash
chmod +x scripts/run-experiments.sh
./scripts/run-experiments.sh
```

This will:
1. Start a local Hardhat node
2. Deploy the ImageRegistry contract
3. Run perceptual hash experiments across all test images
4. Measure gas costs for each contract operation
5. Run Slither static analysis on the contract

Results are saved in the `experiments/` directory:
- `experiments/phash_results.txt` — hash distance tables
- `experiments/gas_results.txt` — gas consumption per operation
- `experiments/slither_report.txt` — security audit output

> Slither must be installed separately: `pip install slither-analyzer`

---

## Using the Python Script Directly

The `phash_generator.py` script can be run standalone to compare an original image against a simulated compressed version:

```bash
# compare original vs. quality-40 compressed version
python3 phash_generator.py test_corpus/original.png

# specify custom compression quality (0-95)
python3 phash_generator.py test_corpus/original.png 20
```

Example output:

```
[phash] extracting dual hash (hash_size=16)...
[phash] dual hash result: a1b2c3...|d4e5f6...
[phash] extracting dual hash (hash_size=16)...
[phash] dual hash result: a1b2c3...|d4e5f7...
[hamming] dual distance is 4
original   : a1b2c3...|d4e5f6...
compressed : a1b2c3...|d4e5f7...
distance   : 4/256 bits (98.4% similar)
verdict    : MATCH
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/anchor` | Compute dual hash and anchor it on-chain |
| `POST` | `/api/verify` | Verify an image against all registry records |
| `GET` | `/api/health` | Check server and contract connectivity |

### POST /api/anchor

**Request:** `multipart/form-data` with fields:
- `file` — the image or PDF to anchor
- `context` — metadata string (date, location, description)

**Response (201):**
```json
{
  "success": true,
  "dualHash": "phash_hex|dhash_hex",
  "author": "0x...",
  "txHash": "0x...",
  "blockNumber": 2
}
```

### POST /api/verify

**Request:** `multipart/form-data` with field:
- `file` — the image or PDF to verify

**Response (200):**
```json
{
  "success": true,
  "verified": true,
  "verdict": "match",
  "distance": 6,
  "record": { "dualHash": "...", "author": "0x...", "timestamp": 1719500000, "context": "..." }
}
```

---

## Running the Tests

```bash
cd server
npm test
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express, Multer |
| Hashing | Python, Pillow, imagehash (DCT + gradient) |
| Blockchain | Solidity 0.8.20, Hardhat, ethers.js v6 |
| Security | Slither static analysis |

---

## License

This project was developed as a master's thesis at the Faculty of Computer Science, "Alexandru Ioan Cuza" University of Iasi.
