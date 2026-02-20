import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";

const { viem } = await hre.network.connect();

describe("PolicyEngine", () => {
  it("preCheck passes for fully allowed module/target/selector/value", async () => {
    const publicClient = await viem.getPublicClient();
    const [deployer] = await viem.getWalletClients();
    const policy = await viem.deployContract("PolicyEngine", [deployer.account.address]);

    const module = "0x0000000000000000000000000000000000000001";
    const target = "0x0000000000000000000000000000000000000002";
    const selector = "0x12345678";

    await policy.write.setMaxValuePerTx([1000n]);
    await policy.write.setModuleAllowed([module, true]);
    await policy.write.setTargetAllowed([target, true]);
    await policy.write.setSelectorAllowed([target, selector, true]);

    const result = await policy.read.preCheck([module, target, selector, 500n]);
    assert.equal(result, undefined);
  });

  it("preCheck reverts for disallowed module", async () => {
    const [deployer] = await viem.getWalletClients();
    const policy = await viem.deployContract("PolicyEngine", [deployer.account.address]);
    const target = "0x0000000000000000000000000000000000000002";

    await assert.rejects(
      () => policy.read.preCheck(["0x0000000000000000000000000000000000000099", target, "0x12345678", 0n]),
      /module blocked/,
    );
  });

  it("preCheck reverts for value exceeding maxValuePerTx", async () => {
    const [deployer] = await viem.getWalletClients();
    const policy = await viem.deployContract("PolicyEngine", [deployer.account.address]);
    const module = "0x0000000000000000000000000000000000000001";
    const target = "0x0000000000000000000000000000000000000002";

    await policy.write.setMaxValuePerTx([100n]);
    await policy.write.setModuleAllowed([module, true]);

    await assert.rejects(
      () => policy.read.preCheck([module, target, "0x12345678", 200n]),
      /value over cap/,
    );
  });

  it("only owner can set allowlists and caps", async () => {
    const [deployer, other] = await viem.getWalletClients();
    const policy = await viem.deployContract("PolicyEngine", [deployer.account.address]);

    const policyOther = await viem.getContractAt("PolicyEngine", policy.address, { client: { wallet: other } });

    await assert.rejects(
      () => policyOther.write.setMaxValuePerTx([999n]),
    );
    await assert.rejects(
      () => policyOther.write.setModuleAllowed(["0x0000000000000000000000000000000000000001", true]),
    );
  });
});
