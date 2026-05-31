import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ImageRegistryModule", (m) => {
  const registry = m.contract("ImageRegistry");
  return { registry };
});
