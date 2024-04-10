import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      chainId: 11155111,
      url: "https://eth-sepolia.api.onfinality.io/public",
      accounts: [
        `9e38521f2352331888f44bcee1103d680f2833bc143bcb8c1e86bb71e66f33ba`,
      ],
    },
  },
};

export default config;
