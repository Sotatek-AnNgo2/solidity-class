import { expect } from "chai";
import { deployments, ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";

describe("Swapper contract", function () {

  async function deploySwapperFixture() {
    // const [owner, otherAccount] = await hre.ethers.getSigners();

    // const Swapper = await hre.ethers.getContractFactory("Swapper");
    // const lock = await Swapper.deploy([owner.address, owner.address], {  });

    const [owner, addr1, addr2] = await ethers.getSigners();
    const { deploy } = deployments;

    const swapperResult = await deploy("Swapper", {
      from: owner.address,
      args: [],
      log: true,
      deterministicDeployment: false,
      proxy: {
        proxyContract: "OptimizedTransparentProxy",
        owner: owner.address,
        execute: {
          methodName: "initialize",
          args: [owner.address, owner.address],
        },
      },
    });

    console.log(swapperResult);

    // const swapper = new ethers.Contract(swapperResult.address, swapperResult.abi);

    return { swapperResult, owner, treasury: owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should deploy success", async function () {
      const {  } = await loadFixture(deploySwapperFixture);

      // console.info(await swapper.getAddress());
      // console.info(await swapper.);
      // const Swapper = await ethers.getContractFactory("Swapper")
      // const swapperv1 = Swapper.attach(swapper);


      // expect(swapper).not.to.be.undefined;
      // expect(swapperProxy).not.to.be.undefined;
    });

    // it("Should set the right owner", async function() {
    //   const { swapper, owner } = await loadFixture(deploySwapperFixture);
    //   const swapperOwner = await swapper.owner();

    //   // swapperProxy

    //   expect(owner.address).equal(swapperOwner);
    // })

    // it("Should set the right treasury", async function() {
    //   const { swapper, treasury } = await loadFixture(deploySwapperFixture);
    //   const treasuryOwner = await swapper.getTreasury();

    //   expect(treasury.address).equal(treasuryOwner);
    // })
  })

  describe("Runtime", async function () {

  })
});
