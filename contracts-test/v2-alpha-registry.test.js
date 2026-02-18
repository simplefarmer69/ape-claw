import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";
import { encodeFunctionData, encodeAbiParameters, parseAbiParameters, encodePacked, keccak256, toHex } from "viem";

const { viem } = await hre.network.connect();

describe("ApeClaw v2-alpha contracts", () => {
  it("mints SkillNFT and publishes immutable version", async () => {
    const publicClient = await viem.getPublicClient();

    const skillNft = await viem.deployContract("SkillNFT");
    const registry = await viem.deployContract("SkillRegistry", [skillNft.address]);

    const mintTx = await skillNft.write.mintSkill([0n]);
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    const owner = await skillNft.read.ownerOf([1n]);
    assert.ok(owner, "owner should exist");

    const versionHash = keccak256(toHex("v1.0.0"));
    const contentHash = keccak256(toHex('{"name":"demo-skill","version":"1.0.0"}'));

    const pubTx = await registry.write.publishVersion([
      1n,
      versionHash,
      contentHash,
      "ipfs://example",
      1,
    ]);
    await publicClient.waitForTransactionReceipt({ hash: pubTx });

    const count = await registry.read.versionCount([1n]);
    assert.equal(count, 1n);

    const v0 = await registry.read.getVersion([1n, 0n]);
    assert.equal(v0.versionHash, versionHash);
    assert.equal(v0.contentHash, contentHash);
    assert.equal(v0.uri, "ipfs://example");
    assert.equal(Number(v0.riskTier), 1);
    assert.ok(Number(v0.publishedAt) > 0);
    assert.ok(v0.publisher);
  });

  it("routes SkillNFT royalties to a PodVault (revenue share)", async () => {
    const publicClient = await viem.getPublicClient();
    const [walletClient] = await viem.getWalletClients();

    const skillNft = await viem.deployContract("SkillNFT");
    const pod = await viem.deployContract("PodVault", [[walletClient.account.address], [1n]]);

    const tx = await skillNft.write.mintSkillWithRoyalty([0n, pod.address, 500]); // 5%
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const sale = 10000n;
    const ri = await skillNft.read.royaltyInfo([1n, sale]);
    const receiver = ri[0];
    const amount = ri[1];
    assert.equal(receiver.toLowerCase(), pod.address.toLowerCase());
    assert.equal(amount, 500n);
  });

  it("creates and cancels intents", async () => {
    const publicClient = await viem.getPublicClient();

    const intents = await viem.deployContract("IntentRegistry");

    const ih = keccak256(toHex("intent:demo"));
    const createTx = await intents.write.createIntent([ih, 0]); // no expiry
    await publicClient.waitForTransactionReceipt({ hash: createTx });

    const i1 = await intents.read.intents([1n]);
    const i1IntentHash = i1.intentHash ?? i1[1];
    const i1Cancelled = i1.cancelled ?? i1[4];
    assert.equal(i1IntentHash, ih);
    assert.equal(i1Cancelled, false);

    const active1 = await intents.read.isActive([1n]);
    assert.equal(active1, true);

    const cancelTx = await intents.write.cancelIntent([1n]);
    await publicClient.waitForTransactionReceipt({ hash: cancelTx });

    const active2 = await intents.read.isActive([1n]);
    assert.equal(active2, false);
  });

  it("ClawllectorPass allows signature-gated free mint", async () => {
    const publicClient = await viem.getPublicClient();
    const [walletClient] = await viem.getWalletClients();
    const signerAddr = walletClient.account.address;

    const pass = await viem.deployContract("ClawllectorPass", [signerAddr, "ipfs://clawllector-pass/"]);

    const now = BigInt(Math.floor(Date.now() / 1000));
    const deadline = Number(now + 600n);

    const chainId = await publicClient.getChainId();
    const packed = encodePacked(
      ["address", "uint64", "uint256", "address"],
      [walletClient.account.address, BigInt(deadline), BigInt(chainId), pass.address],
    );
    const msgHash = keccak256(packed);
    const sig = await walletClient.signMessage({ message: { raw: msgHash } });

    const tx = await pass.write.claim([deadline, sig]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const owner = await pass.read.ownerOf([1n]);
    assert.equal(owner.toLowerCase(), walletClient.account.address.toLowerCase());
  });

  it("records an immutable receipt by traceId hash", async () => {
    const publicClient = await viem.getPublicClient();

    const receipts = await viem.deployContract("ReceiptRegistry");

    const traceIdHash = keccak256(toHex("trace_demo_1"));
    const contentHash = keccak256(toHex('{"type":"pod.heartbeat","ok":true}'));
    const subject = keccak256(toHex("agent:demo-bot"));

    const tx = await receipts.write.recordReceipt([traceIdHash, contentHash, subject, "ipfs://receipt/demo"]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const ok = await receipts.read.isRecorded([traceIdHash]);
    assert.equal(ok, true);

    const r = await receipts.read.getReceipt([traceIdHash]);
    const rTrace = r.traceIdHash ?? r[0];
    const rContent = r.contentHash ?? r[1];
    const rSubject = r.subject ?? r[2];
    const rUri = r.uri ?? r[3];
    const rRecordedAt = r.recordedAt ?? r[4];
    const rRecorder = r.recorder ?? r[5];
    assert.equal(rTrace, traceIdHash);
    assert.equal(rContent, contentHash);
    assert.equal(rSubject, subject);
    assert.equal(rUri, "ipfs://receipt/demo");
    assert.ok(Number(rRecordedAt) > 0);
    assert.ok(rRecorder);
  });

  it("executes a policy-gated module call and records a receipt", async () => {
    const publicClient = await viem.getPublicClient();
    const [walletClient] = await viem.getWalletClients();

    const receipts = await viem.deployContract("ReceiptRegistry");
    const policy = await viem.deployContract("PolicyEngine", [walletClient.account.address]);
    const agent = await viem.deployContract("AgentAccount", [walletClient.account.address, policy.address, receipts.address]);

    const module = await viem.deployContract("SwapModule");
    const target = await viem.deployContract("MockTarget");

    const pingAbi = [
      {
        type: "function",
        name: "ping",
        stateMutability: "payable",
        inputs: [{ name: "x", type: "bytes32" }],
        outputs: [{ type: "bytes32" }],
      },
    ];
    const x = keccak256(toHex("hello"));
    const callData = encodeFunctionData({ abi: pingAbi, functionName: "ping", args: [x] });
    const selector = keccak256(toHex("ping(bytes32)")).slice(0, 10);

    // Policy: allow this module, allow this target, allow this selector, allow zero value.
    const capTx = await policy.write.setMaxValuePerTx([0n]);
    await publicClient.waitForTransactionReceipt({ hash: capTx });
    const mTx = await policy.write.setModuleAllowed([module.address, true]);
    await publicClient.waitForTransactionReceipt({ hash: mTx });
    const tTx = await policy.write.setTargetAllowed([target.address, true]);
    await publicClient.waitForTransactionReceipt({ hash: tTx });
    const sTx = await policy.write.setSelectorAllowed([target.address, selector, true]);
    await publicClient.waitForTransactionReceipt({ hash: sTx });

    const input = encodeAbiParameters(parseAbiParameters("address, bytes"), [target.address, callData]);
    const traceIdHash = keccak256(toHex("trace_agentaccount_1"));
    const subjectHash = keccak256(toHex("agent:demo"));
    const uri = "ipfs://receipt/agentaccount-demo";

    const tx = await agent.write.executeSkill([module.address, input, 0n, traceIdHash, subjectHash, uri]);
    await publicClient.waitForTransactionReceipt({ hash: tx });

    // Verify receipt contentHash matches onchain calculation.
    const expectedOut = keccak256(encodePacked(["bytes32", "address", "uint256"], [x, module.address, 0n]));
    const outputHash = keccak256(expectedOut);
    const inputHash = keccak256(input);
    const contentHash = keccak256(encodePacked(["address", "bytes32", "uint256", "bytes32"], [module.address, inputHash, 0n, outputHash]));

    const ok = await receipts.read.isRecorded([traceIdHash]);
    assert.equal(ok, true);
    const r = await receipts.read.getReceipt([traceIdHash]);
    const rContent = r.contentHash ?? r[1];
    const rSubject = r.subject ?? r[2];
    assert.equal(rContent, contentHash);
    assert.equal(rSubject, subjectHash);

    // Now block selector and confirm it fails closed.
    const sTx2 = await policy.write.setSelectorAllowed([target.address, selector, false]);
    await publicClient.waitForTransactionReceipt({ hash: sTx2 });
    let threw = false;
    try {
      const tx2 = await agent.write.executeSkill([module.address, input, 0n, keccak256(toHex("trace_agentaccount_2")), subjectHash, uri]);
      await publicClient.waitForTransactionReceipt({ hash: tx2 });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });
});

