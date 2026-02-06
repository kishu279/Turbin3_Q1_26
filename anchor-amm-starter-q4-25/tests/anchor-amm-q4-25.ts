import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMint,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { config, expect } from "chai";

describe("anchor-amm-q4-25", () => {
  const provider = anchor.AnchorProvider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);
  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;

  const initializer = anchor.web3.Keypair.generate();

  let userAtaX: anchor.web3.PublicKey;
  let userAtaY: anchor.web3.PublicKey;
  let userLpAta: anchor.web3.PublicKey;

  let mintA: anchor.web3.PublicKey;
  let mintB: anchor.web3.PublicKey;
  let mintLp: anchor.web3.PublicKey;

  let vaultX: anchor.web3.PublicKey;
  let vaultY: anchor.web3.PublicKey;
  let configPda: anchor.web3.PublicKey;

  const seed = new anchor.BN(1234);
  const fee = 300; // 0.3% fee
  let configPdaBump: number;
  let lpPdaBump: number;

  before(async () => {
    // Airdrop SOL to maker and taker
    await provider.connection.requestAirdrop(
      initializer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create mints (decimals=6)
    mintA = await createMint(
      provider.connection,
      provider.wallet.payer,
      initializer.publicKey,
      null,
      6,
    );
    mintB = await createMint(
      provider.connection,
      provider.wallet.payer,
      initializer.publicKey,
      null,
      6,
    );

    // Create ATAs and mint tokens
    // ...
    userAtaX = getAssociatedTokenAddressSync(mintA, initializer.publicKey);
    const makerAtaX = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        userAtaX,
        initializer.publicKey,
        mintA,
      ),
    );
    await provider.sendAndConfirm(makerAtaX);
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mintA,
      userAtaX,
      initializer,
      2_000_000_000,
    ); // 2000 tokens

    userAtaY = getAssociatedTokenAddressSync(mintB, initializer.publicKey);

    const makerAtaY = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        userAtaY,
        initializer.publicKey,
        mintB,
      ),
    );
    await provider.sendAndConfirm(makerAtaY);
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mintB,
      userAtaY,
      initializer,
      2_000_000_000,
    );

    // pda's
    [configPda, configPdaBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId,
    );
    [mintLp, lpPdaBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), configPda.toBuffer()],
      program.programId,
    );

    userLpAta = getAssociatedTokenAddressSync(mintLp, initializer.publicKey);

    // vaults
    vaultX = getAssociatedTokenAddressSync(mintA, configPda, true);
    vaultY = getAssociatedTokenAddressSync(mintB, configPda, true);
  });

  it("Is initialized!", async () => {
    const tx = await program.methods
      .initialize(seed, fee, initializer.publicKey)
      .accountsStrict({
        initializer: initializer.publicKey,
        mintX: mintA,
        mintY: mintB,
        mintLp: mintLp,
        config: configPda,
        vaultX: vaultX,
        vaultY: vaultY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initializer])
      .rpc();

    const configAccount = await program.account.config.fetch(configPda);
    expect(configAccount.fee).to.equal(fee);
    expect(configAccount.configBump).to.equal(configPdaBump);
    expect(configAccount.lpBump).to.equal(lpPdaBump);
    expect(configAccount.locked, "Pool should be unlocked").to.be.false;

    const vaultXBalance = (
      await provider.connection.getTokenAccountBalance(vaultX)
    ).value.uiAmount;
    const vaultYBalance = (
      await provider.connection.getTokenAccountBalance(vaultY)
    ).value.uiAmount;
    console.log("Vault X balance:", vaultXBalance);
    console.log("Vault Y balance:", vaultYBalance);

    console.log("Initialization transaction signature:", tx);
  });

  it("deposit lp", async () => {
    // TODO: Implement deposit test
    let amount = new anchor.BN(1000 * 10 ** 6); // 1000 tokens with 6 decimals

    const tx = await program.methods
      .deposit(
        amount,
        new anchor.BN(900 * 10 ** 6),
        new anchor.BN(1100 * 10 ** 6),
      )
      .accountsStrict({
        user: initializer.publicKey,
        mintX: mintA,
        mintY: mintB,
        mintLp: mintLp,
        config: configPda,
        vaultX: vaultX,
        vaultY: vaultY,
        userLp: userLpAta,
        userX: userAtaX,
        userY: userAtaY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initializer])
      .rpc();

    const vaultXBalance = (
      await provider.connection.getTokenAccountBalance(vaultX)
    ).value.uiAmount;
    const vaultYBalance = (
      await provider.connection.getTokenAccountBalance(vaultY)
    ).value.uiAmount;
    console.log("Vault X balance after deposit:", vaultXBalance);
    console.log("Vault Y balance after deposit:", vaultYBalance);

    const userXBalance = (
      await provider.connection.getTokenAccountBalance(userAtaX)
    ).value.uiAmount;
    const userYBalance = (
      await provider.connection.getTokenAccountBalance(userAtaY)
    ).value.uiAmount;
    const userLpBalance = (
      await provider.connection.getTokenAccountBalance(userLpAta)
    ).value.uiAmount;
    console.log("User X balance after deposit:", userXBalance);
    console.log("User Y balance after deposit:", userYBalance);
    console.log("User LP balance after deposit:", userLpBalance);

    console.log("Deposit transaction signature:", tx);
  });

  it("withdrawl", async () => {
    let amount = new anchor.BN(100 * 10 ** 6); // 100 LP tokens

    const tx = await program.methods
      .withdraw(
        amount,
        new anchor.BN(90 * 10 ** 6),
        new anchor.BN(110 * 10 ** 6),
      )
      .accountsStrict({
        config: configPda,
        mintLp: mintLp,
        mintX: mintA,
        mintY: mintB,
        user: initializer.publicKey,
        userLp: userLpAta,
        userX: userAtaX,
        userY: userAtaY,
        vaultX: vaultX,
        vaultY: vaultY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initializer])
      .rpc();

    const vaultXBalance = (
      await provider.connection.getTokenAccountBalance(vaultX)
    ).value.uiAmount;
    const vaultYBalance = (
      await provider.connection.getTokenAccountBalance(vaultY)
    ).value.uiAmount;
    console.log("Vault X balance after deposit:", vaultXBalance);
    console.log("Vault Y balance after deposit:", vaultYBalance);

    const userXBalance = (
      await provider.connection.getTokenAccountBalance(userAtaX)
    ).value.uiAmount;
    const userYBalance = (
      await provider.connection.getTokenAccountBalance(userAtaY)
    ).value.uiAmount;
    const userLpBalance = (
      await provider.connection.getTokenAccountBalance(userLpAta)
    ).value.uiAmount;
    console.log("User X balance after deposit:", userXBalance);
    console.log("User Y balance after deposit:", userYBalance);
    console.log("User LP balance after deposit:", userLpBalance);

    console.log("Deposit transaction signature:", tx);
  });

  it("swap", async () => {
    let amountIn = new anchor.BN(100 * 10 ** 6); // 100 tokens

    const tx = await program.methods
      .swap(false, amountIn, new anchor.BN(10 * 10 ** 6))
      .accountsStrict({
        config: configPda,
        mintX: mintA,
        mintY: mintB,
        user: initializer.publicKey,
        userX: userAtaX,
        userY: userAtaY,
        vaultX: vaultX,
        vaultY: vaultY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([initializer])
      .rpc();

    const vaultXBalance = (
      await provider.connection.getTokenAccountBalance(vaultX)
    ).value.uiAmount;
    const vaultYBalance = (
      await provider.connection.getTokenAccountBalance(vaultY)
    ).value.uiAmount;
    console.log("Vault X balance after deposit:", vaultXBalance);
    console.log("Vault Y balance after deposit:", vaultYBalance);

    const userXBalance = (
      await provider.connection.getTokenAccountBalance(userAtaX)
    ).value.uiAmount;
    const userYBalance = (
      await provider.connection.getTokenAccountBalance(userAtaY)
    ).value.uiAmount;
    const userLpBalance = (
      await provider.connection.getTokenAccountBalance(userLpAta)
    ).value.uiAmount;
    console.log("User X balance after deposit:", userXBalance);
    console.log("User Y balance after deposit:", userYBalance);
    console.log("User LP balance after deposit:", userLpBalance);

    console.log("Deposit transaction signature:", tx);
  });
});
