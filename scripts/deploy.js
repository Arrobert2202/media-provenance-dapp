import hre from "hardhat";

async function main() {
  const ImageRegistry = await hre.ethers.getContractFactory("ImageRegistry");
  const registry = await ImageRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`ImageRegistry deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
