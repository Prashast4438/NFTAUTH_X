import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFTVModule", (m) => {
  const nftv = m.contract("NFTV");
  return { nftv };
});
