import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { it } from "mocha";
import { expect } from "chai";
import { Swapper } from "../typechain-types";
import { BaseContract } from "ethers";

const TOKEN_A_TOTAL_SUPPLY = 1e10;
const TOKEN_B_TOTAL_SUPPLY = 1e12;

const FEE = 5;

const FROM_AMOUNT = 1e8;
const TO_AMOUNT = 1e10;

const TOKEN_A_FEE_AMOUNT = (BigInt(FROM_AMOUNT) * BigInt(5)) / BigInt(100);
const TOKEN_B_FEE_AMOUNT = (BigInt(TO_AMOUNT) * BigInt(5)) / BigInt(100);
const SENDER_WILL_RECEIVE = BigInt(TO_AMOUNT) - TOKEN_B_FEE_AMOUNT;
const RECEIVER_WILL_RECEIVE = BigInt(FROM_AMOUNT) - TOKEN_A_FEE_AMOUNT;

describe("Swapper contract", function () {
  async function deploySwapperFixture() {
    const Swapper = await ethers.getContractFactory("Swapper");
    const [owner, treasury, sender, receiver] = await ethers.getSigners();

    const swapper = (await upgrades.deployProxy(Swapper, [
      owner.address,
      treasury.address,
    ])) as BaseContract as Swapper;
    await swapper.waitForDeployment();

    const Token = await ethers.getContractFactory("ERC20Mock");
    const tokenA = await Token.deploy("Token A", "AAA", TOKEN_A_TOTAL_SUPPLY);
    const tokenB = await Token.deploy("Token B", "BBB", TOKEN_B_TOTAL_SUPPLY);

    await tokenA.transfer(sender, TOKEN_A_TOTAL_SUPPLY);
    await tokenB.transfer(receiver, TOKEN_B_TOTAL_SUPPLY);

    return { swapper, owner, treasury, sender, receiver, tokenA, tokenB };
  }

  async function deploySwapperFixtureWithFee() {
    const { swapper, ...rest } = await loadFixture(deploySwapperFixture);
    await swapper.setFee(FEE);

    return { swapper, ...rest };
  }

  async function makeSwapRequest() {
    const { swapper, sender, receiver, tokenA, tokenB, treasury } =
      await loadFixture(deploySwapperFixtureWithFee);

    await tokenA
      .connect(sender)
      .approve(await swapper.getAddress(), FROM_AMOUNT);
    await swapper
      .connect(sender)
      .createRequest(
        await receiver.getAddress(),
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        FROM_AMOUNT,
        TO_AMOUNT
      );

    return { swapper, sender, receiver, tokenA, tokenB, treasury };
  }

  async function approveSwapRequest(
    swapRequest: Awaited<ReturnType<typeof makeSwapRequest>>
  ) {
    const { receiver, tokenB, swapper, sender, tokenA } = swapRequest;

    await tokenB
      .connect(receiver)
      .approve(await swapper.getAddress(), TO_AMOUNT);

    await swapper.connect(receiver).approveRequest(1);
    return { swapper, sender, receiver, tokenA, tokenB };
  }

  describe("Deployment", function () {
    it("Should deploy success", async function () {
      const { swapper } = await loadFixture(deploySwapperFixture);

      expect(swapper.getAddress()).not.to.be.undefined;
    });

    it("Should set the right owner", async function () {
      const { swapper, owner } = await loadFixture(deploySwapperFixture);

      expect(owner.address).equal(await swapper.owner());
    });

    it("Should set the right treasury", async function () {
      const { swapper, treasury } = await loadFixture(deploySwapperFixture);

      expect(treasury.address).equal(await swapper.treasury());
    });
  });

  describe("Runtime", function () {
    describe("Set fee", async function () {
      it("Should revert if not owner", async function () {
        const { swapper, receiver } = await loadFixture(deploySwapperFixture);

        await expect(swapper.connect(receiver).setFee(FEE)).to.be.rejectedWith(
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should revert if fee is invalid", async function () {
        const { swapper, receiver } = await loadFixture(deploySwapperFixture);

        await expect(swapper.setFee(102)).to.be.rejectedWith(
          "Fee not valid"
        );
      });

      it("Should set the right tax fee", async function () {
        const { swapper } = await loadFixture(deploySwapperFixture);

        await swapper.setFee(FEE);
        expect(await swapper.fee()).to.equal(FEE);
      });
    });

    describe("Validation", function () {
      it("Should revert if source token is zero address", async function () {
        const { swapper, sender, receiver, tokenB } = await loadFixture(
          deploySwapperFixtureWithFee
        );

        await expect(
          swapper
            .connect(sender)
            .createRequest(
              await receiver.getAddress(),
              ethers.ZeroAddress,
              await tokenB.getAddress(),
              FROM_AMOUNT,
              TO_AMOUNT
            )
        ).to.be.revertedWith("Zero address no allow");
      });

      it("Should revert if destination token is zero address", async function () {
        const { swapper, sender, receiver, tokenA } = await loadFixture(
          deploySwapperFixtureWithFee
        );

        await tokenA
          .connect(sender)
          .approve(await swapper.getAddress(), FROM_AMOUNT);

        await expect(
          swapper
            .connect(sender)
            .createRequest(
              await receiver.getAddress(),
              await tokenA.getAddress(),
              ethers.ZeroAddress,
              FROM_AMOUNT,
              TO_AMOUNT
            )
        ).to.be.revertedWith("Zero address no allow");
      });

      it("Should revert if receiver is zero address", async function () {
        const { swapper, sender, tokenA, tokenB } = await loadFixture(
          deploySwapperFixtureWithFee
        );

        await tokenA
          .connect(sender)
          .approve(await swapper.getAddress(), FROM_AMOUNT);

        await expect(
          swapper
            .connect(sender)
            .createRequest(
              ethers.ZeroAddress,
              await tokenA.getAddress(),
              await tokenB.getAddress(),
              FROM_AMOUNT,
              TO_AMOUNT
            )
        ).to.be.revertedWith("Zero address no allow");
      });
    });

    describe("Swap", function () {
      type SwapperRequest = Awaited<ReturnType<typeof makeSwapRequest>>;
      let swapperRequest: SwapperRequest;

      this.beforeEach(async function () {
        swapperRequest = await makeSwapRequest();
      });

      describe("Make swapper request", async function () {
        it("Should have correct source token amount in contract", async function () {
          const { tokenA, swapper } = swapperRequest;
          expect(await tokenA.balanceOf(await swapper.getAddress())).to.equal(
            FROM_AMOUNT
          );
        });

        it("Should have correct request sender", async function () {
          const { sender, swapper } = swapperRequest;
          expect((await swapper.requests(1)).fromAddress).to.equal(
            sender.address
          );
        });

        it("Should have correct request receiver", async function () {
          const { receiver, swapper } = swapperRequest;
          expect((await swapper.requests(1)).toAddress).to.equal(
            receiver.address
          );
        });

        it("Should have correct source token", async function () {
          const { tokenA, swapper } = swapperRequest;
          expect((await swapper.requests(1)).fromToken).to.equal(
            await tokenA.getAddress()
          );
        });

        it("Should have correct destination token", async function () {
          const { tokenB, swapper } = swapperRequest;
          expect((await swapper.requests(1)).toToken).to.equal(
            await tokenB.getAddress()
          );
        });

        it("Should have correct source amount", async function () {
          const { swapper } = swapperRequest;
          expect((await swapper.requests(1)).fromAmount).to.equal(FROM_AMOUNT);
        });

        it("Should have correct destination amount", async function () {
          const { swapper } = swapperRequest;
          expect((await swapper.requests(1)).toAmount).to.equal(TO_AMOUNT);
        });

        it("Should have correct status", async function () {
          const { swapper } = swapperRequest;
          expect((await swapper.requests(1)).status).to.equal(0);
        });
      });

      describe("Approve swapper request", async function () {
        let approveTx: Awaited<ReturnType<typeof approveSwapRequest>>;

        this.beforeEach(async function () {
          approveTx = await approveSwapRequest(swapperRequest);
        });

        it("Should revert if msg.sender is not receiver", async function () {
          const { swapper, sender } = swapperRequest;
          await expect(
            swapper.connect(sender).approveRequest(1)
          ).to.be.revertedWith("Cannot approve this request");
        });

        it("Should be approved only one time", async function () {
          const { swapper, receiver } = approveTx;
          await expect(
            swapper.connect(receiver).approveRequest(1)
          ).to.be.revertedWith("Cannot approve this request");
        });

        it("Should have Approved status in request", async function () {
          const { swapper } = approveTx;
          expect((await swapper.requests(1)).status).to.equal(1);
        });

        it("Should have enough source token amount as tax fee in treasury", async function () {
          const { treasury, tokenA } = swapperRequest;
          expect(await tokenA.balanceOf(treasury.address)).to.equal(
            BigInt((BigInt(FROM_AMOUNT) * BigInt(FEE)) / BigInt(100))
          );
        });

        it("Should have enough destination token amount as tax fee in treasury", async function () {
          const { treasury, tokenB } = swapperRequest;
          expect(await tokenB.balanceOf(treasury.address)).to.equal(
            BigInt((BigInt(TO_AMOUNT) * BigInt(FEE)) / BigInt(100))
          );
        });

        it("Should have enough source token amount in receiver wallet", async function () {
          const { tokenA, receiver } = approveTx;
          expect(await tokenA.balanceOf(receiver.address)).to.equal(
            RECEIVER_WILL_RECEIVE
          );
        });

        it("Should have enough destination token amount in sender wallet", async function () {
          const { tokenB, sender } = approveTx;
          expect(await tokenB.balanceOf(sender.address)).to.equal(
            SENDER_WILL_RECEIVE
          );
        });
      });

      describe("Cancel swapper request", async function () {
        it("Should revert if msg.sender is not sender", async function () {
          const { swapper, receiver } = swapperRequest;
          await expect(
            swapper.connect(receiver).cancelRequest(1)
          ).to.be.revertedWith("Cannot cancel this request");
        });

        it("Should revert if request is not existed", async function () {
          const { swapper, sender } = swapperRequest;
          await expect(
            swapper.connect(sender).cancelRequest(0)
          ).to.be.revertedWith("Cannot cancel this request");
        });

        it("Should revert if request is not pending", async function () {
          const { swapper, sender } = swapperRequest;
          await swapper.connect(sender).cancelRequest(1);
          await expect(
            swapper.connect(sender).cancelRequest(1)
          ).to.be.revertedWith("Cannot cancel this request");
        });

        it("Should have correct source token amount in sender wallet", async function () {
          const { tokenA, sender, swapper } = swapperRequest;
          await swapper.connect(sender).cancelRequest(1);
          expect(await tokenA.balanceOf(sender.getAddress())).to.equal(
            TOKEN_A_TOTAL_SUPPLY
          );
        });

        it("Should have correct source token amount in contract", async function () {
          const { tokenA, swapper, sender } = swapperRequest;
          await swapper.connect(sender).cancelRequest(1);
          expect(await tokenA.balanceOf(await swapper.getAddress())).to.equal(
            0
          );
        });

        it("Should have Cancelled request status", async function () {
          const { swapper, sender } = swapperRequest;
          await swapper.connect(sender).cancelRequest(1);
          expect((await swapper.requests(1)).status).to.equal(3);
        });
      });

      describe("Reject swapper request", async function () {
        it("Should revert if msg.sender is not receiver", async function () {
          const { swapper, sender } = swapperRequest;
          await expect(
            swapper.connect(sender).rejectRequest(1)
          ).to.be.revertedWith("Cannot reject this request");
        });

        it("Should revert if request is not existed", async function () {
          const { swapper, receiver } = swapperRequest;
          await expect(
            swapper.connect(receiver).rejectRequest(0)
          ).to.be.revertedWith("Cannot reject this request");
        });

        it("Should have correct source token amount in sender wallet", async function () {
          const { tokenA, sender, swapper, receiver } = swapperRequest;
          await swapper.connect(receiver).rejectRequest(1);
          expect(await tokenA.balanceOf(sender.address)).to.equal(
            TOKEN_A_TOTAL_SUPPLY
          );
        });

        it("Should have correct source token amount in contract", async function () {
          const { tokenA, swapper, receiver } = swapperRequest;
          await swapper.connect(receiver).rejectRequest(1);
          expect(await tokenA.balanceOf(await swapper.getAddress())).to.equal(
            0
          );
        });

        it("Should have Rejected request status", async function () {
          const { swapper, receiver } = swapperRequest;
          await swapper.connect(receiver).rejectRequest(1);
          expect((await swapper.requests(1)).status).to.equal(2);
        });

        it("Should revert if request is not pending", async function () {
          const { swapper, receiver } = swapperRequest;
          await swapper.connect(receiver).rejectRequest(1);
          await expect(
            swapper.connect(receiver).rejectRequest(1)
          ).to.be.revertedWith("Cannot reject this request");
        });
      });
    });

    describe("Events", function () {
      it("Should emit RequestCreated event", async function () {
        const { swapper, sender, receiver, tokenA, tokenB } = await loadFixture(
          deploySwapperFixtureWithFee
        );

        await tokenA
          .connect(sender)
          .approve(await swapper.getAddress(), FROM_AMOUNT);

        await expect(
          swapper
            .connect(sender)
            .createRequest(
              await receiver.getAddress(),
              await tokenA.getAddress(),
              await tokenB.getAddress(),
              FROM_AMOUNT,
              TO_AMOUNT
            )
        )
          .to.emit(swapper, "RequestCreated")
          .withArgs(
            1,
            await sender.getAddress(),
            await receiver.getAddress(),
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            FROM_AMOUNT,
            TO_AMOUNT
          );
      });

      it("Should emit RequestApproved event", async function () {
        const { swapper, receiver, tokenB } = await makeSwapRequest();

        await tokenB
          .connect(receiver)
          .approve(await swapper.getAddress(), TO_AMOUNT);
        await expect(swapper.connect(receiver).approveRequest(1))
          .to.emit(swapper, "RequestApproved")
          .withArgs(1);
      });

      it("Should emit RequestCancelled event", async function () {
        const { swapper, sender } = await makeSwapRequest();
        await expect(swapper.connect(sender).cancelRequest(1))
          .to.emit(swapper, "RequestCancelled")
          .withArgs(1);
      });

      it("Should emit RequestRejected event", async function () {
        const { swapper, receiver } = await makeSwapRequest();

        await expect(swapper.connect(receiver).rejectRequest(1))
          .to.emit(swapper, "RequestRejected")
          .withArgs(1);
      });
    });
  });
});
