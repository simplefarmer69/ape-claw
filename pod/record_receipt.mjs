import { createPublicClient, createWalletClient, http, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ReceiptRegistry_ABI } from "../src/lib/v2-onchain-abi.mjs";
import { stableJsonStringify } from "../src/lib/v2-skillcard.mjs";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) { out[k] = true; continue; }
    out[k] = v;
    i++;
  }
  return out;
}

function fail(msg) {
  console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv);
  const rpc = String(args.rpc || "").trim();
  const pk = String(args.privateKey || "").trim();
  const receipts = String(args.receipts || "").trim();
  const traceId = String(args.traceId || args.trace || "").trim();
  const subject = String(args.subject || "agent:unknown").trim();
  const uri = String(args.uri || "").trim();
  const payloadStr = String(args.payload || "").trim();

  if (!rpc) fail("Missing --rpc");
  if (!pk) fail("Missing --privateKey");
  if (!receipts) fail("Missing --receipts");
  if (!traceId) fail("Missing --traceId");

  let payload = {};
  if (payloadStr) {
    try { payload = JSON.parse(payloadStr); } catch { fail("Invalid --payload JSON"); }
  }

  const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
  const transport = http(rpc);
  const publicClient = createPublicClient({ transport });
  const walletClient = createWalletClient({ transport, account });
  const contract = { address: receipts, abi: ReceiptRegistry_ABI };

  const traceIdHash = keccak256(toHex(traceId));
  const subjectHash = keccak256(toHex(subject));
  const contentHash = keccak256(toHex(stableJsonStringify({ subject, payload })));

  const hash = await walletClient.writeContract({
    ...contract,
    functionName: "recordReceipt",
    args: [traceIdHash, contentHash, subjectHash, uri],
  });
  const rec = await publicClient.waitForTransactionReceipt({ hash });

  console.log(JSON.stringify({
    ok: true,
    traceId,
    traceIdHash,
    contentHash,
    subject,
    subjectHash,
    uri,
    txHash: rec.transactionHash,
  }, null, 2));
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: e?.message || String(e) }, null, 2));
  process.exit(1);
});

