# SkillCard Specification

## Overview

A SkillCard is a JSON document that describes a skill available to agents in the ApeClaw ecosystem. SkillCards define inputs, outputs, bindings, constraints, and metadata for skills that can be executed on-chain or off-chain.

## Schema

The canonical JSON structure for a SkillCard:

```json
{
  "slug": "my-skill",
  "name": "My Skill",
  "version": "1.0.0",
  "description": "What this skill does",
  "inputs_schema": { /* JSON Schema */ },
  "outputs_schema": { /* JSON Schema */ },
  "bindings": [ /* ... */ ],
  "constraints": {
    "riskTier": 2,
    "notes": [ /* ... */ ]
  },
  "required_permissions": [ /* ... */ ],
  "examples": [ /* ... */ ],
  "eval_packs": [ /* ... */ ],
  "provenance": { /* ... */ }
}
```

## Field Reference

### Core Fields

#### `name` (required)
- **Type**: `string`
- **Description**: Human-readable name of the skill
- **Example**: `"ApeClaw NFT Autobuy"`
- **Validation**: Non-empty string

#### `slug` (required)
- **Type**: `string`
- **Description**: URL-safe identifier for the skill. Must be unique within a version.
- **Example**: `"apeclaw-nft-autobuy"`
- **Validation**: 
  - Non-empty string
  - Lowercase alphanumeric with hyphens
  - Generated from `name` if not provided: lowercase, trim, replace non-alphanumeric with hyphens

#### `version` (required)
- **Type**: `string`
- **Description**: Semantic version of the skill
- **Example**: `"1.0.0"`
- **Validation**: 
  - Must match pattern: `^[0-9]+(\.[0-9]+){0,3}([\-+][0-9A-Za-z._-]+)?$`
  - Examples: `"1.0.0"`, `"2.1.3"`, `"1.0.0-beta.1"`

#### `description` (required)
- **Type**: `string`
- **Description**: Human-readable description of what the skill does
- **Example**: `"Plan and (optionally) execute multi-collection NFT buys on ApeChain within strict policy gates."`
- **Validation**: Non-empty string

### Schema Definitions

#### `inputs_schema` (required)
- **Type**: `object` (JSON Schema)
- **Description**: JSON Schema defining the inputs required to execute this skill
- **Example**:
```json
{
  "type": "object",
  "required": ["count", "minPrice", "maxPrice"],
  "properties": {
    "count": { "type": "integer", "minimum": 1, "maximum": 25 },
    "minPrice": { "type": "number", "minimum": 0 },
    "maxPrice": { "type": "number", "exclusiveMinimum": 0 }
  }
}
```
- **Validation**: Must be a valid JSON Schema object

#### `outputs_schema` (required)
- **Type**: `object` (JSON Schema)
- **Description**: JSON Schema defining the outputs returned by this skill
- **Example**:
```json
{
  "type": "object",
  "required": ["ok", "planned"],
  "properties": {
    "ok": { "type": "boolean" },
    "planned": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["quoteId", "collection", "tokenId"],
        "properties": {
          "quoteId": { "type": "string" },
          "collection": { "type": "string" },
          "tokenId": { "type": "string" }
        }
      }
    }
  }
}
```
- **Validation**: Must be a valid JSON Schema object

### Bindings

#### `bindings` (required)
- **Type**: `array`
- **Description**: Array of execution bindings that describe how to invoke this skill
- **Example**:
```json
[
  {
    "type": "cli",
    "command": "ape-claw nft autobuy --count <count> --minPrice <minPrice> --maxPrice <maxPrice> --json"
  }
]
```
- **Validation**: Non-empty array

**Binding Object:**
- `type` (required): `string` - Type of binding (`"cli"`, `"http"`, etc.)
- `command` (required for CLI): `string` - Command template with placeholders

### Constraints

#### `constraints` (optional)
- **Type**: `object`
- **Description**: Constraints and risk information for this skill

**Fields:**
- `riskTier` (optional): `integer` - Risk tier (1-3, default: 2)
  - `1`: Low risk (read-only, no on-chain execution)
  - `2`: Medium risk (on-chain execution with policy gates)
  - `3`: High risk (requires explicit confirmation)
- `notes` (optional): `array<string>` - Array of constraint notes
  - Example: `["ApeClaw enforces allowlists, currency allowlist, spend caps, confirm phrases, simulation requirements, and replay protection at the CLI layer."]`

### Permissions

#### `required_permissions` (optional)
- **Type**: `array<string>`
- **Description**: List of permissions required to execute this skill
- **Example**: `["onchain_execute", "market_data"]`
- **Common Values**:
  - `"onchain_execute"`: Requires ability to execute on-chain transactions
  - `"market_data"`: Requires access to market data APIs
  - `"network"`: Requires network access

### Examples

#### `examples` (optional)
- **Type**: `array<object>`
- **Description**: Example invocations of this skill
- **Example**:
```json
[
  {
    "title": "Find a video editor",
    "value": {
      "query": "short-form video editing for twitter thread"
    }
  }
]
```

**Example Object:**
- `title` (required): `string` - Human-readable title
- `value` (required): `object` - Example input values matching `inputs_schema`

### Evaluation

#### `eval_packs` (optional)
- **Type**: `array`
- **Description**: Evaluation packs for testing this skill
- **Default**: `[]`
- **Validation**: Array (currently unused, reserved for future use)

### Provenance

#### `provenance` (optional)
- **Type**: `object`
- **Description**: Metadata about the origin and publisher of this skill
- **Example**:
```json
{
  "publisher": "apeclaw",
  "signed": false,
  "sourceUrl": "https://github.com/apeclaw/skills"
}
```

**Fields:**
- `publisher` (optional): `string` - Publisher identifier (`"apeclaw"`, `"user"`, `"imported"`)
- `signed` (optional): `boolean` - Whether the skill is cryptographically signed
- `sourceUrl` (optional): `string` - URL to the source of this skill

## Content Hashing

The `contentHash` of a SkillCard is computed using the following algorithm (from `v2-skillcard.mjs`):

1. **Stable JSON Serialization**: Convert the SkillCard object to a canonical JSON string with sorted keys:
   ```javascript
   function stableJsonStringify(obj) {
     if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
     if (Array.isArray(obj)) return `[${obj.map(stableJsonStringify).join(",")}]`;
     const keys = Object.keys(obj).sort();
     return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify(obj[k])}`).join(",")}}`;
   }
   ```

2. **Keccak256 Hash**: Hash the canonical JSON string using Keccak256:
   ```javascript
   const canon = stableJsonStringify(skillcardObj);
   const contentHash = keccak256(toHex(canon));
   ```

The content hash uniquely identifies the exact content of a SkillCard, allowing detection of changes even if the version number remains the same.

## Version Hashing

The `versionHash` is computed from the version string:

```javascript
const version = String(versionString || "").trim() || "0.0.0";
const versionHash = keccak256(toHex(version));
```

This creates a deterministic hash of the version string, useful for on-chain version tracking.

## Risk Tiers

| Value | Label | Meaning | Example Skills |
|-------|-------|----------|----------------|
| `1` | Low Risk | Read-only operations, no on-chain execution, no financial risk | Browse/search skills, data queries |
| `2` | Medium Risk | On-chain execution with policy gates, requires allowlists and confirmations | NFT buying, bridging (with policy) |
| `3` | High Risk | High-value operations requiring explicit confirmation phrases | Large transfers, admin operations |

## Validation Rules

1. **Required Fields**: `name`, `slug`, `version`, `description`, `inputs_schema`, `outputs_schema`, `bindings` must be present
2. **Slug Uniqueness**: Within a version, slugs must be unique
3. **Version Format**: Must match semantic version pattern
4. **Schema Validity**: `inputs_schema` and `outputs_schema` must be valid JSON Schema
5. **Risk Tier Range**: `riskTier` must be 1, 2, or 3 (if provided)
6. **Binding Types**: Bindings must specify a valid `type` and appropriate fields for that type

## File Naming Convention

User-submitted SkillCards are stored with the filename pattern:
```
{slug}.v{version}.json
```

Example: `apeclaw-nft-autobuy.v1.0.0.json`

## Example SkillCard

```json
{
  "name": "ApeClaw NFT Autobuy",
  "slug": "apeclaw-nft-autobuy",
  "description": "Plan and (optionally) execute multi-collection NFT buys on ApeChain within strict policy gates. Designed for agents that collect NFTs while you sleep.",
  "version": "1.0.0",
  "inputs_schema": {
    "type": "object",
    "required": ["count", "minPrice", "maxPrice", "currency", "execute", "autonomous"],
    "properties": {
      "count": { "type": "integer", "minimum": 1, "maximum": 25 },
      "scan": { "type": "integer", "minimum": 1, "maximum": 500 },
      "minPrice": { "type": "number", "minimum": 0 },
      "maxPrice": { "type": "number", "exclusiveMinimum": 0 },
      "budget": { "type": ["number", "null"], "minimum": 0 },
      "currency": { "type": "string", "enum": ["APE"] },
      "execute": { "type": "boolean" },
      "autonomous": { "type": "boolean" }
    }
  },
  "outputs_schema": {
    "type": "object",
    "required": ["ok", "planned", "selectedCount"],
    "properties": {
      "ok": { "type": "boolean" },
      "selectedCount": { "type": "integer" },
      "planned": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["quoteId", "collection", "tokenId", "priceApe"],
          "properties": {
            "quoteId": { "type": "string" },
            "collection": { "type": "string" },
            "tokenId": { "type": "string" },
            "priceApe": { "type": "number" }
          }
        }
      }
    }
  },
  "bindings": [
    {
      "type": "cli",
      "command": "ape-claw nft autobuy --count <count> --minPrice <minPrice> --maxPrice <maxPrice> [--scan <scan>] [--budget <budget>] [--execute] [--autonomous] --json"
    }
  ],
  "constraints": {
    "riskTier": 2,
    "notes": [
      "ApeClaw enforces allowlists, currency allowlist, spend caps, confirm phrases, simulation requirements, and replay protection at the CLI layer."
    ]
  },
  "required_permissions": ["onchain_execute", "market_data"],
  "examples": [],
  "eval_packs": [],
  "provenance": {
    "publisher": "apeclaw",
    "signed": false
  }
}
```

## On-Chain Integration

When a SkillCard is deployed on-chain (via V2 contracts), additional metadata is tracked:

- `skillId`: On-chain skill ID (uint256)
- `txHash`: Transaction hash of the mint/publish transaction
- `contentHash`: Keccak256 hash of the canonical JSON (computed as described above)
- `versionHash`: Keccak256 hash of the version string

These hashes enable verification that on-chain skills match their SkillCard definitions.
