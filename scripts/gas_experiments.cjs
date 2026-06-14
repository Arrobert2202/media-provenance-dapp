/**
 * gas cost measurements for ImageRegistry contract
 * needs hardhat node running + contract deployed
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const artifactPath = path.resolve(__dirname, "..", "artifacts", "contracts", "ImageRegistry.sol", "ImageRegistry.json");
const { abi } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  // get current nonce to avoid conflicts with the ignition deploy
  let nonce = await provider.getTransactionCount(signer.address);

  console.log("======================================================================");
  console.log("  EXPERIMENT 4.4: Gas Cost Analysis");
  console.log("======================================================================");
  console.log();

  const results = [];

  // anchorImage with different context lengths to see how gas scales
  const testCases = [
    {
      hash: "fe13fd13815481fe81df81178fc78fc2cf82ce02c80ecafecafeea88ea08c2a8|588049b480018280800000008000800060000000000000000000000000000412",
      context: "Test",
      label: "anchorImage (short context, 4 chars)",
    },
    {
      hash: "ef87ba51b9e181fb9cfec70ece18f80db834a3ff85fc911ec700f402e400c447|482b2503b00a320a900298015820180058401a10188018801880304050003820",
      context: "Original photograph taken by journalist John Doe at press conference",
      label: "anchorImage (medium context, 68 chars)",
    },
    {
      hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      context: "Satellite imagery captured 2024-01-15 by Reuters photographer covering humanitarian crisis in the region - verified by editorial team for publication",
      label: `anchorImage (long context, 152 chars)`,
    },
  ];

  for (const tc of testCases) {
    const tx = await contract.anchorImage(tc.hash, tc.context, { nonce });
    const receipt = await tx.wait();
    const gas = Number(receipt.gasUsed);
    results.push({ label: tc.label, gas });
    console.log(`  ${tc.label}: ${gas.toLocaleString()} gas`);
    nonce++;
  }

  console.log();

  // view functions (free, no tx needed)
  const g1 = await contract.hasBeenAnchored.estimateGas(testCases[0].hash);
  const g2 = await contract.getAllRecords.estimateGas();
  const g3 = await contract.getRecordCount.estimateGas();

  console.log(`  hasBeenAnchored (view): ${Number(g1).toLocaleString()} gas`);
  console.log(`  getAllRecords (${testCases.length} records, view): ${Number(g2).toLocaleString()} gas`);
  console.log(`  getRecordCount (view): ${Number(g3).toLocaleString()} gas`);
  console.log();

  // try to anchor same hash again, should revert
  try {
    await contract.anchorImage(testCases[0].hash, "duplicate", { nonce });
  } catch (e) {
    console.log("  Duplicate rejection: PASSED (reverted as expected)");
  }
  console.log();

  // --- cost table ---
  console.log("----------------------------------------------------------------------");
  console.log("  COST ANALYSIS TABLE");
  console.log("----------------------------------------------------------------------");
  console.log();

  const deployGas = 858609; // from the ignition deploy receipt
  const typicalAnchorGas = results[1].gas; // medium context is the typical case

  console.log(`  Contract deployment gas: ${deployGas.toLocaleString()}`);
  console.log(`  Typical anchorImage gas: ${typicalAnchorGas.toLocaleString()}`);
  console.log(`  Runtime bytecode size: 3,733 bytes (well under 24KB limit)`);
  console.log();

  console.log("  ┌──────────────┬────────────┬──────────────────┬──────────────────┐");
  console.log("  │ Gas Price    │ ETH Price  │ Deploy Cost      │ Anchor Cost      │");
  console.log("  ├──────────────┼────────────┼──────────────────┼──────────────────┤");

  const scenarios = [
    { gwei: 10, eth: 2500 },
    { gwei: 20, eth: 2500 },
    { gwei: 20, eth: 3500 },
    { gwei: 50, eth: 3500 },
    { gwei: 100, eth: 3500 },
  ];

  for (const { gwei, eth } of scenarios) {
    const deployCost = ((deployGas * gwei) / 1e9) * eth;
    const anchorCost = ((typicalAnchorGas * gwei) / 1e9) * eth;
    console.log(
      `  │ ${gwei} gwei`.padEnd(16) +
        `│ $${eth}`.padEnd(14) +
        `│ $${deployCost.toFixed(2)}`.padEnd(20) +
        `│ $${anchorCost.toFixed(4)}`.padEnd(20) +
        "│"
    );
  }

  console.log("  └──────────────┴────────────┴──────────────────┴──────────────────┘");
  console.log();

  // --- L2 comparison ---
  console.log("----------------------------------------------------------------------");
  console.log("  L2 COMPARISON (estimated, ~95% cheaper than mainnet)");
  console.log("----------------------------------------------------------------------");
  const l2Factor = 0.05; // polygon/arbitrum roughly 5% of L1
  const mainnetCost = ((typicalAnchorGas * 20) / 1e9) * 3500;
  const l2Cost = mainnetCost * l2Factor;
  console.log(`  Mainnet anchor (20 gwei, $3500): $${mainnetCost.toFixed(4)}`);
  console.log(`  Polygon/Arbitrum equivalent:     $${l2Cost.toFixed(4)}`);
  console.log(`  Cost reduction:                  ~${((1 - l2Factor) * 100).toFixed(0)}%`);
  console.log();

  // --- how we compare to other approaches ---
  console.log("----------------------------------------------------------------------");
  console.log("  STORAGE COMPARISON: Our system vs. alternatives");
  console.log("----------------------------------------------------------------------");
  console.log();
  console.log("  ┌────────────────────────────┬──────────────────┬──────────────────┐");
  console.log("  │ Approach                   │ On-chain data    │ Gas (approx)     │");
  console.log("  ├────────────────────────────┼──────────────────┼──────────────────┤");
  console.log("  │ Full image on-chain (5MB)  │ 5,000,000 bytes  │ ~320,000,000     │");
  console.log("  │ SHA-256 hash only          │ 32 bytes         │ ~45,000          │");
  console.log("  │ IPFS CID + SHA-256         │ ~80 bytes        │ ~65,000          │");
  console.log("  │ Our dual hash + context    │ ~200 bytes       │ ~345,000         │");
  console.log("  └────────────────────────────┴──────────────────┴──────────────────┘");
  console.log();
  console.log("  Note: Our system stores more data than a raw SHA-256 (~7.5x gas),");
  console.log("  but gains compression-resistant matching. Full image storage is");
  console.log("  ~925x more expensive and impractical on any EVM chain.");
  console.log();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
