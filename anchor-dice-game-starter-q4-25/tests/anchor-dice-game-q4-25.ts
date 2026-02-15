import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorDiceGameQ425 } from "../target/types/anchor_dice_game_q4_25.js";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import {
  Ed25519Program,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import { BN } from "bn.js";

describe("anchor-dice-game-q4-25", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .anchorDiceGameQ425 as Program<AnchorDiceGameQ425>;

  let house: anchor.web3.Keypair;
  let player: anchor.web3.Keypair;
  let player2: anchor.web3.Keypair;

  let vaultPda: anchor.web3.PublicKey;
  let vaultBump: number;

  let amount: anchor.BN = new anchor.BN(1000000000);
  let seed: anchor.BN = new anchor.BN(123);
  let seed2: anchor.BN = new anchor.BN(456);

  let bet: anchor.web3.PublicKey;
  let bet2: anchor.web3.PublicKey;

  before(async () => {
    // KEYPAIR
    house = anchor.web3.Keypair.generate();
    player = anchor.web3.Keypair.generate();
    player2 = anchor.web3.Keypair.generate();

    // AIRDROP SOL
    await provider.connection.requestAirdrop(
      house.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.requestAirdrop(
      player.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.requestAirdrop(
      player2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // derive the vault pda
    [vaultPda, vaultBump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), house.publicKey.toBuffer()],
      program.programId,
    );
  });

  it("Is initialized!", async () => {
    // Add your test here.
    // const tx = await program.methods.initialize().rpc();
    // console.log("Your transaction signature", tx);

    const tx = await program.methods
      .initialize(amount)
      .accountsPartial({
        house: house.publicKey,
        vault: vaultPda,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([house])
      .rpc();

    const vaultBalance = (await provider.connection.getAccountInfo(vaultPda))
      .lamports;

    console.log("Your transaction signature", tx);
    console.log("Vault balance", vaultBalance);
  });

  it("Play game!", async () => {
    const tx = await program.methods
      .placeBet(seed, 50, new anchor.BN(anchor.web3.LAMPORTS_PER_SOL / 100))
      .accountsPartial({
        player: player.publicKey,
        house: house.publicKey,
        vault: vaultPda,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([player])
      .rpc();

    await confirmTransaction(tx);

    // await new Promise((resolve) => setTimeout(resolve, 1000));

    const vaultBalance = (await provider.connection.getAccountInfo(vaultPda))
      .lamports;

    const [betPda, betPdaBump] =
      await anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("bet"),
          vaultPda.toBuffer(),
          seed.toArrayLike(Buffer, "le", 16),
        ],
        program.programId,
      );

    bet = betPda;

    console.log("Vault balance", vaultBalance);
  });

  it("Resolve bet!", async () => {
    // let account = await anchor
    //   .getProvider()
    //   .connection.getAccountInfo(bet, "confirmed");
    let account = await provider.connection.getAccountInfo(bet, "confirmed");
    console.log("Bet account data:", account);
    let sigIx = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: house.secretKey,
      message: account.data.subarray(8),
    });
    const resolveIx = await program.methods
      .resolveBet(Buffer.from(sigIx.data.slice(16 + 32, 16 + 32 + 64)))
      .accountsStrict({
        house: house.publicKey,
        player: player.publicKey,
        vault: vaultPda,
        bet,
        instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([house])
      .instruction();
    const tx = new Transaction().add(sigIx).add(resolveIx);
    try {
      await sendAndConfirmTransaction(provider.connection, tx, [house]);
    } catch (error) {
      console.error("Error confirming transaction:", error);
    }
  });

  // it("refund from bet", async () => {
  //   const tx = await program.methods
  //     .refundBet()
  //     .accountsPartial({
  //       player: player.publicKey,
  //       house: house.publicKey,
  //       vault: vaultPda,
  //       bet,
  //       systemProgram: SYSTEM_PROGRAM_ID,
  //     })
  //     .signers([player])
  //     .rpc();

  //   await confirmTransaction(tx);
  // });

  it("Player2 places a bet!", async () => {
    await program.methods
      .placeBet(seed2, 50, new anchor.BN(anchor.web3.LAMPORTS_PER_SOL / 100))
      .accountsPartial({
        player: player2.publicKey,
        house: house.publicKey,
        vault: vaultPda,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([player2])
      .rpc();

    const [betPda] = await anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("bet"),
        vaultPda.toBuffer(),
        seed2.toArrayLike(Buffer, "le", 16),
      ],
      program.programId,
    );

    bet2 = betPda;
  });

  it("Player2 refunds bet!", async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await program.methods
      .refundBet()
      .accountsPartial({
        player: player2.publicKey,
        house: house.publicKey,
        vault: vaultPda,
        bet: bet2,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .signers([player2])
      .rpc();
  });
});

const confirmTransaction = async (txSig: string): Promise<string> => {
  const latestBlockHash = await anchor
    .getProvider()
    .connection.getLatestBlockhash();
  await anchor.getProvider().connection.confirmTransaction(
    {
      signature: txSig,
      ...latestBlockHash,
    },
    "confirmed",
  );

  return txSig;
};
