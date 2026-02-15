import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { QuadraticVoting } from "../target/types/quadratic_voting";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("quadratic-voting", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.quadraticVoting as Program<QuadraticVoting>;

  let creator: anchor.web3.Keypair;
  let dao: anchor.web3.PublicKey;
  let daoName = "Test DAO";
  let proposal: anchor.web3.PublicKey;
  let proposalName = "Test Proposal";

  let voter1: anchor.web3.Keypair;
  let voter2: anchor.web3.Keypair;
  let voter3: anchor.web3.Keypair;

  // Token-related variables
  let governanceTokenMint: anchor.web3.PublicKey;
  let voter1TokenAccount: anchor.web3.PublicKey;
  let voter2TokenAccount: anchor.web3.PublicKey;
  let voter3TokenAccount: anchor.web3.PublicKey;

  before(async () => {
    creator = anchor.web3.Keypair.generate();

    voter1 = anchor.web3.Keypair.generate();
    voter2 = anchor.web3.Keypair.generate();
    voter3 = anchor.web3.Keypair.generate();

    // Airdrop SOL for transaction fees
    await provider.connection.requestAirdrop(creator.publicKey, 1_000_000_000);
    await provider.connection.requestAirdrop(voter1.publicKey, 1_000_000_000);
    await provider.connection.requestAirdrop(voter2.publicKey, 1_000_000_000);
    await provider.connection.requestAirdrop(voter3.publicKey, 1_000_000_000);
    
    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create governance token mint
    governanceTokenMint = await createMint(
      provider.connection,
      creator,
      creator.publicKey, // mint authority
      null, // freeze authority (null = no freeze)
      9 // decimals
    );

    console.log("Governance Token Mint:", governanceTokenMint.toString());

    // Create ATAs for voters and mint tokens
    // Voter 1: 100 tokens (10 voting credits = sqrt(100))
    const voter1ATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator,
      governanceTokenMint,
      voter1.publicKey
    );
    voter1TokenAccount = voter1ATA.address;
    await mintTo(
      provider.connection,
      creator,
      governanceTokenMint,
      voter1TokenAccount,
      creator,
      100_000_000_000 // 100 tokens with 9 decimals
    );

    // Voter 2: 25 tokens (5 voting credits = sqrt(25))
    const voter2ATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator,
      governanceTokenMint,
      voter2.publicKey
    );
    voter2TokenAccount = voter2ATA.address;
    await mintTo(
      provider.connection,
      creator,
      governanceTokenMint,
      voter2TokenAccount,
      creator,
      25_000_000_000 // 25 tokens
    );

    // Voter 3: 16 tokens (4 voting credits = sqrt(16))
    const voter3ATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator,
      governanceTokenMint,
      voter3.publicKey
    );
    voter3TokenAccount = voter3ATA.address;
    await mintTo(
      provider.connection,
      creator,
      governanceTokenMint,
      voter3TokenAccount,
      creator,
      16_000_000_000 // 16 tokens
    );

    // DERIVED PDAS
    const [daoPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("dao"), creator.publicKey.toBuffer(), Buffer.from(daoName)],
      program.programId,
    );
    dao = daoPda;

    const [proposalPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("proposal"), dao.toBuffer(), Buffer.from(proposalName)],
      program.programId,
    );
    proposal = proposalPda;
  });

  it("Initialize the dao", async () => {
    const tx = await program.methods
      .initializeDao(daoName)
      .accountsStrict({
        creator: creator.publicKey,
        daoAccount: dao,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();
  });

  it("Create a proposal", async () => {
    const tx = await program.methods
      .initializeProposal(proposalName)
      .accountsStrict({
        creator: creator.publicKey,
        daoAccount: dao,
        proposalAccount: proposal,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([creator])
      .rpc();
  });

  it("Cast votes", async () => {
    // Derive vote PDA for voter1
    const [vote1Pda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("vote"), voter1.publicKey.toBuffer(), proposal.toBuffer()],
      program.programId
    );

    // Voter 1 votes YES with 100 tokens (10 voting credits = sqrt(100))
    const tx1 = await program.methods
      .castVote(1) // 1 = Yes vote
      .accountsStrict({
        voter: voter1.publicKey,
        daoAccount: dao,
        proposalAccount: proposal,
        voteAccount: vote1Pda,
        tokenMint: governanceTokenMint,
        voterTokenAccount: voter1TokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([voter1])
      .rpc();

    console.log("Voter 1 voted YES with tx:", tx1);

    // Derive vote PDA for voter2
    const [vote2Pda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("vote"), voter2.publicKey.toBuffer(), proposal.toBuffer()],
      program.programId
    );

    // Voter 2 votes NO with 25 tokens (5 voting credits = sqrt(25))
    const tx2 = await program.methods
      .castVote(0) // 0 = No vote
      .accountsStrict({
        voter: voter2.publicKey,
        daoAccount: dao,
        proposalAccount: proposal,
        voteAccount: vote2Pda,
        tokenMint: governanceTokenMint,
        voterTokenAccount: voter2TokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([voter2])
      .rpc();

    console.log("Voter 2 voted NO with tx:", tx2);

    // Fetch and display proposal results
    const proposalAccount = await program.account.proposal.fetch(proposal);
    console.log("\n=== Voting Results ===");
    console.log("YES votes:", proposalAccount.yesVoteCount.toString());
    console.log("NO votes:", proposalAccount.noVoteCount.toString());
  });
});
