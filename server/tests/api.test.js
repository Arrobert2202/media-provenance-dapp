"use strict";

const request = require("supertest");
const path    = require("path");
const fs      = require("fs");

const FAKE_PHASH_ORIGINAL   = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FAKE_PHASH_COMPRESSED = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab";
const FAKE_PHASH_UNRELATED  = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

jest.mock("child_process", () => {
  const EventEmitter = require("events");

  const defaultSequence = [
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab",
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  ];

  if (typeof global.__mockPHashIndex === "undefined") {
    global.__mockPHashIndex    = 0;
    global.__mockPHashSequence = [...defaultSequence];
  }

  return {
    spawn: jest.fn(() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const seq      = global.__mockPHashSequence || defaultSequence;
      const fakeHash = seq[(global.__mockPHashIndex || 0) % seq.length];
      global.__mockPHashIndex = (global.__mockPHashIndex || 0) + 1;

      const child = Object.assign(new EventEmitter(), { stdout, stderr });
      process.nextTick(() => {
        stdout.emit("data", fakeHash + "\n");
        child.emit("close", 0);
      });
      return child;
    }),
  };
});

const { app, registry } = require("../server");

const FIXTURES_DIR = path.join(__dirname, "fixtures");

function ensureFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const minimalJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  ["original.jpg", "compressed.jpg", "unrelated.jpg"].forEach((name) => {
    const p = path.join(FIXTURES_DIR, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, minimalJpeg);
  });
}

const fixturePath = (name) => path.join(FIXTURES_DIR, name);

function seedRegistry(phash, record) {
  registry.set(phash, {
    phash,
    author   : record.author    || "0xTestAuthor000000000000000000000000000000",
    timestamp: record.timestamp || Math.floor(Date.now() / 1000),
    context  : record.context   || "Test context",
  });
}

const clearFromRegistry = (phash) => registry.delete(phash);

const resetMock = (sequence) => {
  global.__mockPHashIndex    = 0;
  global.__mockPHashSequence = sequence;
};

beforeAll(ensureFixtures);

afterAll(() => {
  ["original.jpg", "compressed.jpg", "unrelated.jpg"].forEach((name) => {
    const p = fixturePath(name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
});

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
    expect(typeof res.body.registrySize).toBe("number");
  });
});

describe("POST /api/anchor", () => {
  beforeEach(() => resetMock([FAKE_PHASH_ORIGINAL, FAKE_PHASH_ORIGINAL, FAKE_PHASH_ORIGINAL]));
  afterEach(() => clearFromRegistry(FAKE_PHASH_ORIGINAL));

  it("✅ should anchor a new image and return a valid transaction simulation", async () => {
    const res = await request(app)
      .post("/api/anchor")
      .attach("image", fixturePath("original.jpg"))
      .field("context", "Protest in Piața Victoriei | Bucharest | 01/05/2026 18:30")
      .field("author",  "0xJournalist000000000000000000000000000001");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.phash).toBe(FAKE_PHASH_ORIGINAL);
    expect(res.body.author).toBe("0xJournalist000000000000000000000000000001");
    expect(res.body.context).toBe("Protest in Piața Victoriei | Bucharest | 01/05/2026 18:30");
    expect(res.body.timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 5);
    expect(res.body.txHash).toMatch(/^0x[0-9a-f]+$/i);
    expect(res.body.blockNumber).toBeGreaterThanOrEqual(19_000_000);
    expect(res.body.blockNumber).toBeLessThanOrEqual(20_000_000);
  });

  it("✅ should auto-generate a wallet address when author is not provided", async () => {
    const res = await request(app)
      .post("/api/anchor")
      .attach("image", fixturePath("original.jpg"))
      .field("context", "Auto-wallet test");

    expect(res.status).toBe(201);
    expect(res.body.author).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it("✅ should return 409 when the same image is anchored twice", async () => {
    const first = await request(app)
      .post("/api/anchor")
      .attach("image", fixturePath("original.jpg"))
      .field("context", "First anchor");

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/anchor")
      .attach("image", fixturePath("original.jpg"))
      .field("context", "Duplicate attempt");

    expect(second.status).toBe(409);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.error).toMatch(/already registered/i);
    expect(second.body.existing.phash).toBe(FAKE_PHASH_ORIGINAL);
    expect(second.body.existing.context).toBe("First anchor");
  });

  it("✅ should return 400 when no image is provided", async () => {
    const res = await request(app).post("/api/anchor").field("context", "No image");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no image/i);
  });

  it("✅ should return 400 when context is missing", async () => {
    const res = await request(app).post("/api/anchor").attach("image", fixturePath("original.jpg"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/context/i);
  });
});

describe("POST /api/verify", () => {
  beforeEach(() => {
    seedRegistry(FAKE_PHASH_ORIGINAL, {
      author   : "0xJournalist000000000000000000000000000001",
      context  : "Protest in Piața Victoriei | Bucharest | 01/05/2026 18:30",
      timestamp: 1746100200,
    });
  });
  afterEach(() => clearFromRegistry(FAKE_PHASH_ORIGINAL));

  it("✅ should return verified=true with distance=0 for the original image", async () => {
    resetMock([FAKE_PHASH_ORIGINAL]);
    const res = await request(app).post("/api/verify").attach("image", fixturePath("original.jpg"));

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.distance).toBe(0);
    expect(res.body.phash).toBe(FAKE_PHASH_ORIGINAL);
    expect(res.body.record.author).toBe("0xJournalist000000000000000000000000000001");
    expect(res.body.record.context).toBe("Protest in Piața Victoriei | Bucharest | 01/05/2026 18:30");
  });

  it("✅ should return verified=true for a compressed/WhatsApp version (fuzzy match)", async () => {
    resetMock([FAKE_PHASH_COMPRESSED]);
    const res = await request(app).post("/api/verify").attach("image", fixturePath("compressed.jpg"));

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.distance).toBeGreaterThan(0);
    expect(res.body.distance).toBeLessThanOrEqual(10);
    expect(res.body.phash).toBe(FAKE_PHASH_COMPRESSED);
    expect(res.body.record.phash).toBe(FAKE_PHASH_ORIGINAL);
  });

  it("✅ should return verified=false for a fake/unregistered image (disinformation scenario)", async () => {
    resetMock([FAKE_PHASH_UNRELATED]);
    const res = await request(app).post("/api/verify").attach("image", fixturePath("unrelated.jpg"));

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.record).toBeNull();
    expect(res.body.distance).toBeNull();
  });

  it("✅ should return 400 when no image is provided to /verify", async () => {
    const res = await request(app).post("/api/verify");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no image/i);
  });

  it("✅ should return verified=false when the registry is empty", async () => {
    resetMock([FAKE_PHASH_ORIGINAL]);
    const snapshot = new Map(registry);
    registry.clear();
    try {
      const res = await request(app).post("/api/verify").attach("image", fixturePath("original.jpg"));
      expect(res.body.verified).toBe(false);
      expect(res.body.record).toBeNull();
    } finally {
      snapshot.forEach((v, k) => registry.set(k, v));
    }
  });
});

describe("Input validation & edge cases", () => {
  beforeEach(() => resetMock([FAKE_PHASH_ORIGINAL]));

  it("✅ should reject non-image file uploads with 400", async () => {
    const txtPath = path.join(FIXTURES_DIR, "malicious.txt");
    fs.writeFileSync(txtPath, "not an image");
    try {
      const res = await request(app)
        .post("/api/anchor")
        .attach("image", txtPath, { contentType: "text/plain" })
        .field("context", "Malicious upload");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    } finally {
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
  });

  it("✅ should return 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nonexistent");
    expect(res.status).toBe(404);
  });
});
