# ImageTrace

A decentralised image traceability system. Journalists anchor a perceptual hash of an original photograph on-chain. Anyone can later verify whether a circulating image matches the registered original, even after lossy re-compression.

## Structure

```
/
├── phash_generator.py
├── ImageRegistry.sol
├── server/
│   ├── package.json
│   └── server.js
└── client/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── JournalistPortal.jsx
            ├── VerifyPortal.jsx
            ├── ImageDropzone.jsx
            └── Spinner.jsx
```

## Requirements

- Python 3.9+
- Node.js 18+
- npm 9+

```bash
pip install Pillow imagehash
```

## Backend

```bash
cd server
npm install
npm start
```

Runs on `http://localhost:3001`.

| Endpoint      | Method | Description                |
|---------------|--------|----------------------------|
| /api/anchor   | POST   | Register an image hash     |
| /api/verify   | POST   | Verify an image            |
| /api/health   | GET    | Health check               |

To run tests:

```bash
npm test
```

## Frontend

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173`. All `/api` requests are proxied to the backend.

## How it works

When a journalist uploads an image, the server computes a perceptual hash (pHash) via `phash_generator.py` and stores the record in the registry. The pHash is a 256-bit fingerprint derived from the image's DCT coefficients, which makes it stable across re-compression and minor resizing.

On verification, the same hash is computed for the uploaded image and compared against the registry. An exact match returns the original record. A fuzzy match (Hamming distance up to 10 bits) catches copies that went through lossy compression. If nothing matches, the image is flagged as unverified.

The current registry is in-memory. For production, replace it with calls to the deployed `ImageRegistry.sol` contract via ethers.js.
