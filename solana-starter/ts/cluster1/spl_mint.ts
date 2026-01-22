import { Keypair, PublicKey, Connection, Commitment } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import wallet from "../turbin3-wallet.json";

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

const token_decimals = 6n; // Number of decimal places (most tokens use 6)

// Mint address
const mint = new PublicKey("FcywknjdPKaYaYs4MRHmfrnRkJopbM9ZFXUcUTVmhgiT");

(async () => {
  try {
    // Create an ATA
    // const ata = ???
    // console.log(`Your ata is: ${ata.address.toBase58()}`);

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      keypair.publicKey
    );
    console.log(`Your ata is: ${ata.address.toBase58()}`);
    // Mint to ATA
    // const mintTx = ???
    // console.log(`Your mint txid: ${mintTx}`);
    const mintTx = await mintTo(
      connection,
      keypair,
      mint,
      ata.address,
      keypair,
      10n * 10n ** token_decimals, 
    );
    console.log(`Your mint txid: ${mintTx}`);
  } catch (error) {
    console.log(`Oops, something went wrong: ${error}`);
  }
})();


// ATA - CFA3maqcooaBorYM8PZE2PerA8gYV59iTLRVFfFa3Hod
// MINT TXID - 46SvAiUkRuin6oP9N77wFLuykrrkvccKFcEJUB3ZVWETANHXaEsALRoDh9podNZVT6YFJEWJrz6r8p34gCzKYfX6