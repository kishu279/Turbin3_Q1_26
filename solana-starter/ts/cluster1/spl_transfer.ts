import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import wallet from "../turbin3-wallet.json";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

// Mint address
const mint = new PublicKey("FcywknjdPKaYaYs4MRHmfrnRkJopbM9ZFXUcUTVmhgiT");

// Recipient address
const to = new PublicKey("A7zrBSAhXJsVs95aRji8TdMw3ZwxCFJEDHK49J2mVT45");
// const to = new PublicKey("Cw2VW7tg7inFCLDSQBy52LyKHKZiqALe2JNadGnQFacL");

(async () => {
  try {
    // Get the token account of the fromWallet address, and if it does not exist, create it
    const formTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      keypair.publicKey
    );
    console.log(`From Token Account: ${formTokenAccount.address.toBase58()}`);
    // Get the token account of the toWallet address, and if it does not exist, create it
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      to
    );
    console.log(`To Token Account: ${toTokenAccount.address.toBase58()}`);
    // Transfer the new token to the "toTokenAccount" we just created
    const signature = await transfer(
      connection,
      keypair,
      formTokenAccount.address,
      toTokenAccount.address,
      keypair.publicKey,
      1000_000n
    );
    console.log(`Transfer tx signature: ${signature}`);
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
