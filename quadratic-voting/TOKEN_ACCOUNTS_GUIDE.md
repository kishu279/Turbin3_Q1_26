# Token Accounts in Solana - Complete Guide

## Overview

In your quadratic voting program, you need token accounts to track how many governance tokens each voter holds. The token balance determines voting power using the quadratic formula: **voting_credits = √(token_amount)**

## Two Types of Token Accounts

### 1. **Associated Token Account (ATA)** ✅ RECOMMENDED

- **Deterministic PDA** derived from: `[owner_pubkey, token_program_id, mint_pubkey]`
- Each user has **exactly one ATA per token mint**
- Standard across Solana ecosystem
- Expected by wallets, DEXs, and most programs

### 2. **Regular Token Account**

- Can be any keypair or custom PDA
- Used for special cases (escrow accounts, vaults, program-owned accounts)
- Requires manual management

## Your Implementation

### In Rust Program ([cast_vote.rs](programs/quadratic-voting/src/instructions/cast_vote.rs))

```rust
#[account(
    mut,
    associated_token::mint = token_mint,
    associated_token::authority = voter,
)]
pub voter_token_account: Account<'info, TokenAccount>,
```

**What this does:**

- Validates the account is an ATA
- Ensures it's for the correct mint (`token_mint`)
- Ensures it's owned by the correct authority (`voter`)
- Anchor **automatically derives** the ATA address using the constraint

### In TypeScript Tests ([quadratic-voting.ts](tests/quadratic-voting.ts))

```typescript
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

// Create ATA for voter
const voterATA = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mintAddress,
  voterPublicKey,
);

// The ATA address is deterministic:
// voterATA.address = derive_pda([voter, TOKEN_PROGRAM_ID, mint])
```

## How ATAs are Derived

### Formula:

```
ATA_ADDRESS = findProgramAddress(
  [
    voter_pubkey.toBuffer(),
    TOKEN_PROGRAM_ID.toBuffer(),
    mint_pubkey.toBuffer()
  ],
  ASSOCIATED_TOKEN_PROGRAM_ID
)
```

### Example (your test):

```typescript
// These three pieces of information uniquely identify the ATA:
// 1. Owner: voter1.publicKey
// 2. Mint: governanceTokenMint
// 3. Token Program: TOKEN_PROGRAM_ID

// The ATA address is computed deterministically:
const voter1ATA = getAssociatedTokenAddressSync(
  governanceTokenMint,
  voter1.publicKey,
);
```

## Complete Flow in Your Program

### 1. Setup Phase (in tests)

```typescript
// Create governance token mint
const mint = await createMint(connection, payer, mintAuthority, null, 9);

// Create ATA for voter (happens once)
const voterATA = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  voterPublicKey,
);

// Mint tokens to voter's ATA
await mintTo(connection, payer, mint, voterATA.address, mintAuthority, 100);
```

### 2. Voting Phase (in program)

```rust
// Read token balance from ATA
let token_amount = self.voter_token_account.amount;

// Calculate voting power (quadratic)
let voting_credits = (token_amount as f64).sqrt() as u64;

// Record vote
self.vote_account.vote_credits = voting_credits;
```

## Key Concepts

### Why ATAs?

1. **Predictable**: Same inputs → same address (every time)
2. **Standard**: All Solana wallets/programs expect ATAs
3. **One per mint**: Simplifies token management
4. **Secure**: Owned by user, validated by program

### Token Amount & Decimals

```typescript
// If mint has 9 decimals:
100 tokens = 100_000_000_000 (raw amount)

// In program, sqrt is calculated on raw amount:
sqrt(100_000_000_000) = 316_227 voting credits
```

### Account Validation

The constraint `associated_token::mint = token_mint` ensures:

- ✅ Account is a valid ATA
- ✅ ATA is for the correct token mint
- ✅ ATA is owned by the signer (voter)
- ❌ Prevents using wrong token
- ❌ Prevents using someone else's ATA

## Common Patterns

### Pattern 1: User-owned ATA (your case)

```rust
#[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = user,
)]
pub user_token_account: Account<'info, TokenAccount>,
```

### Pattern 2: Program-owned vault (for escrow)

```rust
#[account(
    init,
    payer = user,
    associated_token::mint = mint,
    associated_token::authority = program_vault,
)]
pub vault_token_account: Account<'info, TokenAccount>,
```

## Testing Your Implementation

```bash
# Build program
anchor build

# Run tests
anchor test

# Expected output:
# Voter 1 (100 tokens) → 10 voting credits
# Voter 2 (25 tokens) → 5 voting credits
# Voter 3 (16 tokens) → 4 voting credits
```

## Troubleshooting

### Error: "associated token account constraint violated"

- **Cause**: Provided account is not an ATA or for wrong mint
- **Solution**: Use `getOrCreateAssociatedTokenAccount()` in tests

### Error: "constraint has one authority"

- **Cause**: ATA owner doesn't match expected authority
- **Solution**: Ensure ATA is owned by the voter/signer

### Error: "insufficient funds"

- **Cause**: Voter's ATA has no tokens
- **Solution**: Mint tokens to ATA before voting

## Resources

- [SPL Token Program Docs](https://spl.solana.com/token)
- [Associated Token Account Program](https://spl.solana.com/associated-token-account)
- [Anchor Token Constraints](https://www.anchor-lang.com/docs/the-accounts-struct#constraints)
