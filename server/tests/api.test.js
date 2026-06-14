"use strict";

const request = require("supertest");
const path    = require("path");
const fs      = require("fs");

// mock hashes for the python subprocess
const FAKE_HASH_ORIGINAL   = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FAKE_HASH_COMPRESSED = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FAKE_HASH_UNRELATED  = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff|eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// in-memory store to simulate the contract
let mockRecords = [];
let mockAnchored = new Map();

// mock child_process so we don't need python
jest.mock("child_process", () => {
  const EventEmitter = require("events");

  if (typeof global.__mockPHashIndex === "undefined") {
    global.__mockPHashIndex = 0;
    global.__mockPHashSequence = [FAKE_HASH_ORIGINAL];
  }

  return {
    spawn: jest.fn(() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const seq = global.__mockPHashSequence || [FAKE_HASH_ORIGINAL];
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

// mock ethers so we don't need hardhat node
jest.mock("ethers", () => {
  const mockContract = {
    hasBeenAnchored: async (hash) => mockAnchored.has(hash),
    anchorImage: async (hash, context) => {
      mockAnchored.set(hash, true);
      mockRecords.push({
        dualHash: hash,
        author: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        context,
      });
      return {
        wait: async () => ({
          hash: "0x" + "a".repeat(64),
          blockNumber: 42n,
          gasUsed: 327534n,
        }),
      };
    },
    getAllRecords: async () => mockRecords,
    getRecordCount: async () => BigInt(mockRecords.length),
  };

  const ethers = {
    JsonRpcProvider: function() { return {}; },
    Wallet: function() { return { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" }; },
    Contract: function() { return mockContract; },
  };

  return { ethers, ...ethers };
});

const { app } = require("../server");

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

const resetMock = (sequence) => {
  global.__mockPHashIndex = 0;
  global.__mockPHashSequence = sequence;
};

beforeAll(ensureFixtures);

beforeEach(() => {
  mockRecords = [];
  mockAnchored = new Map();
});

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
  beforeEach(() => resetMock([FAKE_HASH_ORIGINAL]));

  it("should anchor a new image and return success", async () => {
    const res = await request(app)
      .post("/api/anchor")
      .attach("file", fixturePath("original.jpg"))
      .field("context", "Protest in Piata Victoriei | Bucharest | 2026-05-01");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.dualHash).toBe(FAKE_HASH_ORIGINAL);
    expect(res.body.author).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(res.body.context).toBe("Protest in Piata Victoriei | Bucharest | 2026-05-01");
    expect(res.body.txHash).toMatch(/^0x[0-9a-f]+$/i);
  });

  it("should return 409 when the same image is anchored twice", async () => {
    resetMock([FAKE_HASH_ORIGINAL, FAKE_HASH_ORIGINAL]);

    const first = await request(app)
      .post("/api/anchor")
      .attach("file", fixturePath("original.jpg"))
      .field("context", "First anchor");

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/anchor")
      .attach("file", fixturePath("original.jpg"))
      .field("context", "Duplicate attempt");

    expect(second.status).toBe(409);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.error).toMatch(/already registered/i);
  });

  it("should return 400 when no image is provided", async () => {
    const res = await request(app).post("/api/anchor").field("context", "No image");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it("should return 400 when context is missing", async () => {
    const res = await request(app).post("/api/anchor").attach("file", fixturePath("original.jpg"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/context/i);
  });
});

describe("POST /api/verify", () => {
  beforeEach(() => {
    // seed registry with one record
    mockRecords.push({
      dualHash: FAKE_HASH_ORIGINAL,
      author: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      timestamp: BigInt(1746100200),
      context: "Protest in Piata Victoriei | Bucharest | 2026-05-01",
    });
    mockAnchored.set(FAKE_HASH_ORIGINAL, true);
  });

  it("should return verified=true with distance=0 for the original image", async () => {
    resetMock([FAKE_HASH_ORIGINAL]);
    const res = await request(app).post("/api/verify").attach("file", fixturePath("original.jpg"));

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.distance).toBe(0);
    expect(res.body.dualHash).toBe(FAKE_HASH_ORIGINAL);
    expect(res.body.record.author).toMatch(/^0x/);
  });

  it("should return verified=true for a compressed version (fuzzy match)", async () => {
    resetMock([FAKE_HASH_COMPRESSED]);
    const res = await request(app).post("/api/verify").attach("file", fixturePath("compressed.jpg"));

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.distance).toBeGreaterThan(0);
    expect(res.body.distance).toBeLessThanOrEqual(10);
  });

  it("should return verified=false for an unrelated image", async () => {
    resetMock([FAKE_HASH_UNRELATED]);
    const res = await request(app).post("/api/verify").attach("file", fixturePath("unrelated.jpg"));

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.record).toBeNull();
    expect(res.body.distance).toBeNull();
  });

  it("should return 400 when no image is provided", async () => {
    const res = await request(app).post("/api/verify");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it("should return verified=false when the registry is empty", async () => {
    mockRecords = [];
    resetMock([FAKE_HASH_ORIGINAL]);
    const res = await request(app).post("/api/verify").attach("file", fixturePath("original.jpg"));
    expect(res.body.verified).toBe(false);
    expect(res.body.record).toBeNull();
  });
});

describe("Input validation", () => {
  beforeEach(() => resetMock([FAKE_HASH_ORIGINAL]));

  it("should reject non-image file uploads with 400", async () => {
    const txtPath = path.join(FIXTURES_DIR, "malicious.txt");
    fs.writeFileSync(txtPath, "not an image");
    try {
      const res = await request(app)
        .post("/api/anchor")
        .attach("file", txtPath, { contentType: "text/plain" })
        .field("context", "Malicious upload");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    } finally {
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
  });

  it("should return 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nonexistent");
    expect(res.status).toBe(404);
  });
});
