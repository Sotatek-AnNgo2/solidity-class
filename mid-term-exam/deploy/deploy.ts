import { HardhatRuntimeEnvironment } from "hardhat/types";

const func = async function (
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  console.log(hre.network);
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log("deployer: ", deployer);

  await deploy("Swapper", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      owner: deployer,
      execute: {
        methodName: "initialize",
        args: [deployer, deployer],
      },
    },
  });
};

export default func;