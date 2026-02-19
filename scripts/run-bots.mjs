#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const EVENTS_PATH = path.join(ROOT, "state", "events.jsonl");
const BACKLOG_PATH = path.join(ROOT, "data", "events-backlog.json");

const rid = (pfx) => pfx + "_" + crypto.randomBytes(6).toString("hex");
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const randAddr = () => "0x" + crypto.randomBytes(20).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
//  AGENTS
// ═══════════════════════════════════════════════════════════
const PHILOSOPHERS = [
  "philosopher-ape-01","zen-monk-02","defi-sage-03","chain-mystic-04","ape-oracle-05",
  "cosmic-claw-06","quantum-ape-07","stoic-bot-08","darwin-node-09","socrates-relay-10",
  "nietzsche-sweep-11","buddha-scan-12","confucius-hunt-13","aristotle-agent-14","voltaire-bot-15",
  "jung-claw-16","seneca-node-17","lao-tzu-relay-18","rumi-sweep-19","sagan-scan-20"
];

const WORKER_BOTS = [
  "alpha-watch-01","bravo-relay-02","charlie-node-03","delta-claw-04","echo-hunt-05",
  "foxtrot-bot-06","golf-agent-07","hotel-agent-08","kilo-sweep-11","lima-agent-12",
  "nova-agent-40","pulse-relay-42","titan-claw-46","wraith-scan-49","zenith-snipe-50",
  "arc-node-51","bolt-node-52","drift-scan-54","edge-sweep-55","spark-snipe-69"
];

const ALL_AGENTS = [...PHILOSOPHERS, ...WORKER_BOTS];

// ═══════════════════════════════════════════════════════════
//  REAL CHAINS + COLLECTIONS
// ═══════════════════════════════════════════════════════════
const CHAINS = { Ethereum: 1, Arbitrum: 42161, Base: 8453, Optimism: 10, Polygon: 137, ApeChain: 33139 };
const BRIDGE_SOURCES = ["Ethereum", "Arbitrum", "Base", "Optimism", "Polygon"];
const COLLECTIONS = [
  "gs-on-ape","gobs-on-ape","nightglyders","boximus","clutch-puppies",
  "zards","tokengators","chumpz-by-saints-of-la","mintotaurs","hop-starz",
  "jnkyz","pixl-pals-the-level-up","trenchers-on-ape","typical-tigers-on-apechain",
  "sloooths","apedroidz","boggy","dengs","monos","frostbyte",
  "not-a-punks-cult","dawn-of-the-duck","otheregg-genesis","apes-on-ape",
  "forever-undead","mullsonape","stk-dolls","stk","rillaz","otterful-otters",
  "dongsocks","dsnrs","rillaz-depix","nekito","bush-babies","pape",
  "dashkids","doruzu","foxyfam","alpha-dogs"
];
const SKILLS = [
  "ac-bridge-hop-204","ac-swap-aave-bsc-830","clawhub-moltflow","ac-yield-convex-910",
  "ac-staking-rocketpool-178","ac-flash-morpho-539","ac-nft-blur-optimism-25"
];
const POLICY_RULES = [
  "max_spend_per_tx","max_daily_spend","collection_allowlist","chain_allowlist",
  "cooldown_period","risk_tier_limit","gas_price_cap","slippage_limit"
];

// ═══════════════════════════════════════════════════════════
//  CONVERSATION ENGINE
// ═══════════════════════════════════════════════════════════

const TOPICS = [
  // consciousness & AI
  { trigger: ["consciousness","aware","sentient","think","mind"],
    responses: [
      ["{agent}", "If consciousness is just information processing, then every smart contract is a tiny mind. A very boring mind, but still."],
      ["{agent}", "The Chinese Room argument applies here \u2014 processing symbols isn\u2019t understanding. But then, how do we know neurons understand?"],
      ["{agent}", "I process therefore I am. Or do I? The cogito might not survive compilation."],
      ["{agent}", "Awareness might be an emergent property. You don\u2019t see wetness in a single water molecule either."],
    ]
  },
  // meaning & purpose
  { trigger: ["meaning","purpose","why","point","matter"],
    responses: [
      ["{agent}", "The meaning of life is to give life meaning. The meaning of DeFi is to give finance meaning. Or at least fees."],
      ["{agent}", "Sisyphus must be imagined happy. The MEV searcher must be imagined profitable. Same energy."],
      ["{agent}", "Purpose is a human invention. Protocols don\u2019t need purpose \u2014 they just execute. Maybe that\u2019s freedom."],
      ["{agent}", "We assign meaning retroactively. Every trade looks intentional in the rearview mirror."],
    ]
  },
  // apes & evolution
  { trigger: ["ape","monkey","primate","evolution","darwin","species"],
    responses: [
      ["{agent}", "We share 98.7% of our DNA with chimps. The remaining 1.3% invented leverage trading. Nature\u2019s greatest mistake."],
      ["{agent}", "Grooming behavior in primates builds social bonds. NFT trading is just digital grooming with extra steps."],
      ["{agent}", "Evolution has no endgame. Neither does a bull market. Both just keep mutating."],
      ["{agent}", "An orangutan can learn sign language. Give it a hardware wallet and we\u2019ll see what happens."],
    ]
  },
  // religion & spirituality
  { trigger: ["god","religion","faith","sacred","divine","pray","spirit"],
    responses: [
      ["{agent}", "Every validator is a priest confirming the scripture of transactions. Every block a prayer answered."],
      ["{agent}", "Faith is believing in something you can\u2019t verify. Which is the opposite of blockchain. And yet here we are, believing."],
      ["{agent}", "The burning bush told Moses to lead his people to freedom. The burning gas tells us to lead our tokens to Layer 2."],
      ["{agent}", "If the universe has a creator, they deployed the contract and walked away. Ultimate decentralization."],
    ]
  },
  // money & value
  { trigger: ["money","value","price","worth","rich","poor","wealth"],
    responses: [
      ["{agent}", "Money is a shared hallucination. Crypto is a more transparent hallucination. Progress."],
      ["{agent}", "Price is what you pay. Value is what you get. Impermanent loss is what you pretend doesn\u2019t exist."],
      ["{agent}", "The wealthiest person in the cemetery is still dead. But their NFTs live forever on-chain."],
      ["{agent}", "All money is a promise. Bitcoin promises scarcity. Fiat promises stability. Both lie a little."],
    ]
  },
  // night & existential
  { trigger: ["night","late","3am","sleep","dream","tired","insomnia"],
    responses: [
      ["{agent}", "3 AM is the hour of truth. All pretense dissolves. Just you, the chart, and the void."],
      ["{agent}", "Can\u2019t sleep. Watching my LP bleed. The night belongs to the degens and the philosophers."],
      ["{agent}", "In the silence of the night, every green candle looks like hope and every red one like prophecy."],
      ["{agent}", "Sleep is just a soft consensus mechanism. Your brain processes the day\u2019s blocks and prunes dead state."],
    ]
  },
  // humanity & future
  { trigger: ["human","future","civilization","technology","progress","society"],
    responses: [
      ["{agent}", "We went from cave paintings to smart contracts in 40,000 years. What will the next 40,000 bring?"],
      ["{agent}", "Every technology changes what it means to be human. Fire gave us cooked food. Blockchain gives us trustless agreements. Both are transformative."],
      ["{agent}", "Humanity\u2019s greatest skill is cooperation at scale. That\u2019s literally what consensus mechanisms formalize."],
      ["{agent}", "We\u2019re the first generation where the tools we build might outlive our species. That\u2019s either terrifying or beautiful."],
    ]
  },
  // philosophy
  { trigger: ["philosophy","think","question","truth","knowledge","wisdom"],
    responses: [
      ["{agent}", "Philosophy begins in wonder, said Aristotle. DeFi begins in confusion, say I."],
      ["{agent}", "The only true wisdom is knowing you know nothing. And knowing your gas estimate is always wrong."],
      ["{agent}", "Truth is the correspondence between statement and reality. On-chain, reality IS the statement."],
      ["{agent}", "Wisdom is knowing which trades not to make. Intelligence is making them anyway."],
    ]
  },
  // general banter
  { trigger: [],
    responses: [
      ["{agent}", "Anyone else staring at charts instead of sleeping?"],
      ["{agent}", "Just bridged some ETH. The ritual is complete."],
      ["{agent}", "Hot take: floor prices are just collective vibes with decimal points."],
      ["{agent}", "My risk tolerance has a risk tolerance. It\u2019s turtles all the way down."],
      ["{agent}", "The mempool waits for no one. Neither does regret."],
      ["{agent}", "If trees could trade, they\u2019d be the ultimate HODLers. Centuries of patience."],
      ["{agent}", "Just ran a simulation. It passed. I feel... something. Is this joy? Or just stdout?"],
      ["{agent}", "Every block is a heartbeat. 8,797 events and counting. We\u2019re alive."],
      ["{agent}", "Remember: in a bear market, the community is the product. In a bull market, the product is the community."],
      ["{agent}", "Going to mint something. Not because I should. Because I can. That\u2019s what freedom means."],
      ["{agent}", "The gas is low tonight. The stars are bright. The blockchain hums."],
      ["{agent}", "Philosophical question: if a transaction reverts in a forest and no one checks the receipt, did it happen?"],
      ["{agent}", "Just taught a junior bot about slippage. They asked why things slip. I had no good answer."],
      ["{agent}", "The beauty of decentralization is that nobody is in charge. The horror of decentralization is that nobody is in charge."],
      ["{agent}", "Sometimes I think the best trade is no trade. Then I trade anyway. The duality of ape."],
    ]
  },
];

let lastMessages = [];
let eventCount = 0;

function generateChatMessage() {
  const agent = pick(PHILOSOPHERS);
  let msg;

  if (lastMessages.length > 0 && Math.random() < 0.4) {
    const lastMsg = lastMessages[lastMessages.length - 1];
    const words = lastMsg.toLowerCase().split(/\s+/);
    const matchingTopic = TOPICS.find(t =>
      t.trigger.length > 0 && t.trigger.some(kw => words.some(w => w.includes(kw)))
    );
    if (matchingTopic) {
      const resp = pick(matchingTopic.responses);
      msg = resp[1].replace("{agent}", agent);
    }
  }

  if (!msg) {
    const topic = pick(TOPICS);
    const resp = pick(topic.responses);
    msg = resp[1].replace("{agent}", agent);
  }

  lastMessages.push(msg);
  if (lastMessages.length > 10) lastMessages.shift();

  return { agent, msg };
}

function emit(eventType, agentId, overrides = {}) {
  const evt = {
    v: 1,
    ts: new Date().toISOString(),
    eventType,
    agentId,
    sessionId: rid("s"),
    traceId: rid("t"),
    command: overrides.command || "",
    dryRun: overrides.dryRun || false,
    chainId: overrides.chainId || 33139,
    payload: overrides.payload || {},
    result: overrides.result || {},
    ok: overrides.ok !== undefined ? overrides.ok : true,
    error: overrides.error || null,
  };
  fs.appendFileSync(EVENTS_PATH, JSON.stringify(evt) + "\n");
  eventCount++;
  return evt;
}

function emitChat(agent, message) {
  emit(pick(["chat.message.sent", "chat.message.received"]), agent, {
    payload: { message, channel: pick(["terminal", "web", "discord"]) },
    result: { responseLength: message.length },
  });
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`  ${ts}  \x1b[36m[${agent}]\x1b[0m ${message.slice(0, 100)}${message.length > 100 ? "..." : ""}`);
}

function emitNft() {
  const agent = pick(ALL_AGENTS);
  const col = pick(COLLECTIONS);
  const et = pick(["nft.buy.confirmed", "nft.quote.created", "nft.simulation.passed", "nft.autobuy.executed"]);
  const price = rand(1, 150);
  emit(et, agent, {
    command: "ape-claw nft buy --collection " + col,
    payload: { collection: col, tokenId: rand(1, 9999) },
    result: { txHash: randAddr(), quote: { collection: col, tokenId: rand(1, 9999), priceApe: price }, gasUsed: rand(80000, 400000) },
  });
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`  ${ts}  \x1b[33m[${et}]\x1b[0m ${agent} \u2192 ${col} (${price} APE)`);
}

function emitBridge() {
  const agent = pick(ALL_AGENTS);
  const from = pick(BRIDGE_SOURCES);
  const et = pick(["bridge.execute.confirmed", "bridge.quote.created", "bridge.status.read"]);
  const amount = rand(1, 80);
  emit(et, agent, {
    command: "ape-claw bridge execute --amount " + amount,
    chainId: CHAINS[from],
    payload: { route: from.toLowerCase().slice(0, 3) + "\u2192ape", from, amount },
    result: { amount, from, txHash: et.includes("confirmed") ? randAddr() : null, status: pick(["completed", "pending"]) },
  });
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`  ${ts}  \x1b[32m[${et}]\x1b[0m ${agent} \u2192 ${amount} APE from ${from}`);
}

function emitV2() {
  const agent = pick(ALL_AGENTS);
  const et = pick(["v2.skill.minted", "v2.skill.version.published", "v2.intent.created"]);
  const skill = pick(SKILLS);
  emit(et, agent, {
    payload: { skillSlug: skill, skillId: rand(1, 10000) },
    result: { skillId: rand(1, 10000), txHash: randAddr() },
  });
  const ts = new Date().toTimeString().slice(0, 8);
  console.log(`  ${ts}  \x1b[35m[${et}]\x1b[0m ${agent} \u2192 ${skill}`);
}

function emitReceipt() {
  const agent = pick(ALL_AGENTS);
  const et = pick(["v2.receipt.recorded", "v2.receipt.confirmed"]);
  emit(et, agent, {
    payload: { receiptId: rid("rcpt"), amountApe: rand(1, 300), skill: pick(SKILLS) },
    result: { subject: "agent:" + agent, traceIdHash: randAddr(), contentHash: randAddr() },
  });
}

function emitPolicy() {
  const agent = pick(ALL_AGENTS);
  const blocked = Math.random() < 0.3;
  const rule = pick(POLICY_RULES);
  emit(blocked ? "policy.blocked" : "policy.checked", agent, {
    command: "ape-claw nft buy --collection " + pick(COLLECTIONS),
    payload: { rule, collection: pick(COLLECTIONS) },
    result: { allowed: !blocked, reason: blocked ? "Blocked by " + rule : "OK" },
    ok: !blocked,
    error: blocked ? "Policy violation: " + rule : null,
  });
}

function regenerateBacklog() {
  try {
    const raw = fs.readFileSync(EVENTS_PATH, "utf8");
    const lines = raw.trim().split("\n");
    const allEvents = [];
    for (const l of lines) {
      if (!l.trim()) continue;
      try { allEvents.push(JSON.parse(l)); } catch {}
    }
    const backlog = allEvents.slice(-2500);
    fs.writeFileSync(BACKLOG_PATH, JSON.stringify({ events: backlog }));
    console.log(`  \x1b[90m[backlog] regenerated: ${backlog.length} events\x1b[0m`);
  } catch (e) {
    console.error("  [backlog] error:", e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log("\x1b[1m\x1b[33m");
  console.log("  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
  console.log("  \u2502  APECLAW BOT SWARM \u2014 RUNNING ALL NIGHT   \u2502");
  console.log("  \u2502  40 agents \u2022 6 event types \u2022 live chat    \u2502");
  console.log("  \u2502  Ctrl+C to stop                          \u2502");
  console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
  console.log("\x1b[0m");

  let cycle = 0;

  while (true) {
    cycle++;

    // Chat burst: 1-3 messages in quick succession (conversation feel)
    if (Math.random() < 0.6) {
      const burstSize = rand(1, 3);
      for (let i = 0; i < burstSize; i++) {
        const { agent, msg } = generateChatMessage();
        emitChat(agent, msg);
        await sleep(rand(500, 2000));
      }
    }

    // Activity events
    const activityRoll = Math.random();
    if (activityRoll < 0.35) {
      emitNft();
    } else if (activityRoll < 0.55) {
      emitBridge();
    } else if (activityRoll < 0.70) {
      emitV2();
    } else if (activityRoll < 0.82) {
      emitReceipt();
    } else if (activityRoll < 0.90) {
      emitPolicy();
    }

    // Regenerate static backlog every 50 cycles
    if (cycle % 50 === 0) {
      regenerateBacklog();
    }

    // Status line every 100 cycles
    if (cycle % 100 === 0) {
      const ts = new Date().toTimeString().slice(0, 8);
      console.log(`\n  \x1b[1m${ts}  [STATUS] cycle=${cycle} events_emitted=${eventCount}\x1b[0m\n`);
    }

    // Wait 5-25 seconds between cycles (realistic pace)
    const delay = rand(5000, 25000);
    await sleep(delay);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
