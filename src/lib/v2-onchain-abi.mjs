export const SkillNFT_ABI = [
  {
    type: "function",
    name: "mintSkill",
    stateMutability: "nonpayable",
    inputs: [{ name: "parentId", type: "uint256" }],
    outputs: [{ name: "skillId", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintSkillWithRoyalty",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentId", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "feeBps", type: "uint96" },
    ],
    outputs: [{ name: "skillId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setSkillRoyalty",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skillId", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "feeBps", type: "uint96" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "royaltyInfo",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "salePrice", type: "uint256" },
    ],
    outputs: [
      { name: "receiver", type: "address" },
      { name: "royaltyAmount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "nextSkillId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

export const SkillRegistry_ABI = [
  {
    type: "function",
    name: "publishVersion",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skillId", type: "uint256" },
      { name: "versionHash", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "uri", type: "string" },
      { name: "riskTier", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "versionCount",
    stateMutability: "view",
    inputs: [{ name: "skillId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
];

export const IntentRegistry_ABI = [
  {
    type: "function",
    name: "createIntent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentHash", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [{ name: "intentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelIntent",
    stateMutability: "nonpayable",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isActive",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
];

export const ReceiptRegistry_ABI = [
  {
    type: "function",
    name: "recordReceipt",
    stateMutability: "nonpayable",
    inputs: [
      { name: "traceIdHash", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "subject", type: "bytes32" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isRecorded",
    stateMutability: "view",
    inputs: [{ name: "traceIdHash", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getReceipt",
    stateMutability: "view",
    inputs: [{ name: "traceIdHash", type: "bytes32" }],
    outputs: [
      {
        name: "receipt",
        type: "tuple",
        components: [
          { name: "traceIdHash", type: "bytes32" },
          { name: "contentHash", type: "bytes32" },
          { name: "subject", type: "bytes32" },
          { name: "uri", type: "string" },
          { name: "recordedAt", type: "uint64" },
          { name: "recorder", type: "address" },
        ],
      },
    ],
  },
];

export const PolicyEngine_ABI = [
  {
    type: "function",
    name: "setMaxValuePerTx",
    stateMutability: "nonpayable",
    inputs: [{ name: "v", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setModuleAllowed",
    stateMutability: "nonpayable",
    inputs: [{ name: "module", type: "address" }, { name: "allowed", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setTargetAllowed",
    stateMutability: "nonpayable",
    inputs: [{ name: "target", type: "address" }, { name: "allowed", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setSelectorAllowed",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "preCheck",
    stateMutability: "view",
    inputs: [
      { name: "module", type: "address" },
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
];

export const AgentAccount_ABI = [
  {
    type: "function",
    name: "executeSkill",
    stateMutability: "payable",
    inputs: [
      { name: "module", type: "address" },
      { name: "input", type: "bytes" },
      { name: "value", type: "uint256" },
      { name: "traceIdHash", type: "bytes32" },
      { name: "subjectHash", type: "bytes32" },
      { name: "uri", type: "string" },
    ],
    outputs: [{ name: "output", type: "bytes" }],
  },
  {
    type: "function",
    name: "setPolicyEngine",
    stateMutability: "nonpayable",
    inputs: [{ name: "policyEngine", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setReceiptRegistry",
    stateMutability: "nonpayable",
    inputs: [{ name: "receiptRegistry", type: "address" }],
    outputs: [],
  },
];

