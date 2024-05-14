import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { it } from "mocha";
import { expect } from "chai";
import { Swapper } from "../typechain-types";
import { BaseContract } from "ethers";

describe("Swapper contract", function () {

  async function deploySwapperFixture() {
    const Swapper = await ethers.getContractFactory("Swapper");
    const [owner, treasury, sender, receiver] = await ethers.getSigners();

    const swapper = (await upgrades.deployProxy(Swapper, [
      owner.address,
      treasury.address,
    ])) as BaseContract as Swapper;
    await swapper.waitForDeployment();

    // console.log(owner.address)
    // const swapperResult = await deploy("Swapper", {
    //   from: owner.address,
    //   args: [],
    //   log: true,
    //   deterministicDeployment: false,
    //   proxy: {
    //     proxyContract: "OptimizedTransparentProxy",
    //     owner: owner.address,
    //     execute: {
    //       methodName: "initialize",
    //       args: [owner.address, owner.address],
    //     },
    //   },
    // });

    // console.log(swapperResult);

    // const swapper = new ethers.Contract(swapperResult.address, swapperResult.abi);

    return { swapper };
  }

  describe("Deployment", function () {
    it("Should deploy success", async function () {
      const { swapper } = await loadFixture(deploySwapperFixture);

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
