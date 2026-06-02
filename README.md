# ImageTrace — Decentralised Image Traceability

A proof-of-concept system that lets journalists anchor a **perceptual hash (pHash)** of an original photograph on the Ethereum blockchain. Anyone can later upload a potentially compressed or re-shared version of that image and verify whether it matches a registered original — even after lossy re-compression (e.g. WhatsApp, social media).

---

## How It Works

1. A journalist uploads an image and metadata (date, location, description).
2. A **perceptual hash** is computed from the image using DCT-based hashing.
3. The hash is stored permanently in the `ImageRegistry` smart contract on-chain.
4. To verify, anyone uploads a suspicious image. The system computes its hash and compares it to every registered record using **Hamming distance**.
5. A distance ≤ 10 bits (out of 256) is considered a match — meaning the images are visually identical even if one was compressed.

---

## Project Structure

```
├── contracts/          # Solidity smart contract (ImageRegistry.sol)
├── ignition/           # Hardhat Ignition deploy module
├── client/             # React frontend (Vite + Tailwind)
├── server/             # Node.js / Express API backend
├── phash_generator.py  # Python pHash engine (standalone + importable)
└── hardhat.config.js   # Hardhat configuration
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| Python | ≥ 3.9 |
| MetaMask | Any recent version |

---

## Setup

### 1. Python dependencies

```bash
pip install Pillow imagehash
# only needed if you want PDF support:
pip install pdf2image
```

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

Starts a local blockchain at `http://127.0.0.1:8545` and prints 20 funded test accounts.

### Step 2 — Deploy the smart contract

In a new terminal, from the project root:

```bash
npx hardhat ignition deploy ignition/modules/ImageRegistry.js --network localhost
```

The deployed contract address will be printed to the console. It defaults to `0x5FbDB2315678afecb367f032d93F642f64180aa3` on a fresh node.

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

## Using the Python Script Directly

The `phash_generator.py` script can be run standalone to compare an original image against a simulated compressed version — useful for demonstrating the Hamming distance threshold.

```bash
# basic usage — compares original vs. quality-40 compressed version
python3 phash_generator.py original.png

# specify a custom compression quality (0–95)
python3 phash_generator.py original.png 20
```

**Example output:**

```
[phash] extracting hash (hash_size=16)...
[phash] hash result: f8f0e0c0a0b0d0e0f8f0e0c0a0b0d0e0...
[phash] extracting hash (hash_size=16)...
[phash] hash result: f8f0e0c0a0b0d0e0f8f0e0c0a0b0d0e0...
[hamming] distance is 4
original   : f8f0e0c0a0b0d0e0...
compressed : f8f0e0c0a0b0d0e0... (page 1 only)
distance   : 4/256 bits (98.4% similar)
verdict    : MATCH
```

**Verdict thresholds:**

| Distance | Verdict |
|----------|---------|
| ≤ 10 bits | `MATCH` — same image, possibly compressed |
| 11 – 20 bits | `UNCERTAIN` — possibly related |
| > 20 bits | `NO MATCH` — different image |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/anchor` | Compute pHash and anchor it on-chain |
| `POST` | `/api/verify` | Verify an image against all registry records |
| `GET` | `/api/health` | Check server and contract connectivity |

---

## Running the Tests

```bash
cd server
npm test
```
