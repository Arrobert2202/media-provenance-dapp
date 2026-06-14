#!/bin/bash
# runs all chapter 4 experiments: starts hardhat, deploys, runs hash + gas tests, slither

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Create output directory
mkdir -p experiments

echo "=============================================="
echo "  experiment suite"
echo "=============================================="
echo ""

# ---- Step 1: Start Hardhat Node ----
echo "[1/5] Starting Hardhat node..."
npx hardhat node > /dev/null 2>&1 &
HARDHAT_PID=$!
sleep 4

# Verify it's running
if ! curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' > /dev/null 2>&1; then
  echo "ERROR: Hardhat node failed to start"
  exit 1
fi
echo "  Hardhat node running (PID $HARDHAT_PID)"
echo ""

# ---- Step 2: Deploy contract ----
echo "[2/5] Deploying ImageRegistry contract..."
DEPLOY_OUTPUT=$(npx hardhat ignition deploy ignition/modules/ImageRegistry.js --network localhost 2>&1)
CONTRACT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "ImageRegistryModule#ImageRegistry" | tail -1 | awk '{print $NF}')
echo "  Contract deployed at: $CONTRACT_ADDR"
echo ""

# ---- Step 3: Run pHash experiments ----
echo "[3/5] Running perceptual hash experiments..."
python3 scripts/phash_experiments.py 2>&1 | tee experiments/phash_results.txt
echo ""

# ---- Step 4: Run gas cost experiments ----
echo "[4/5] Running gas cost measurements..."
node scripts/gas_experiments.cjs 2>&1 | tee experiments/gas_results.txt
echo ""

# ---- Step 5: Run Slither ----
echo "[5/5] Running Slither security analysis..."
slither contracts/ImageRegistry.sol --solc-remaps "" 2>&1 | tee experiments/slither_report.txt
echo ""

# ---- Cleanup ----
echo "Stopping Hardhat node..."
kill $HARDHAT_PID 2>/dev/null || true
wait $HARDHAT_PID 2>/dev/null || true
echo ""
echo "=============================================="
echo "  All experiments completed!"
echo "  Results saved in experiments/"
echo "    - experiments/phash_results.txt"
echo "    - experiments/gas_results.txt"
echo "    - experiments/slither_report.txt"
echo "=============================================="
