const { ethers } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log(
        "Deploying contracts with the account:",
        await deployer.getAddress()
    );

    const MyContract = await ethers.getContractFactory("SotatekStandrardToken");
    const myContract = await MyContract.deploy("Peace", "PEA", "999999999999999999", { gasLimit: 8000000})
    console.log("Contract address:",  myContract.target);

  }

  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });