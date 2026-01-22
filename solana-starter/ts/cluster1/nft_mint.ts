import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  signerIdentity,
  generateSigner,
  percentAmount,
} from "@metaplex-foundation/umi";
import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

import wallet from "../turbin3-wallet.json";
import base58 from "bs58";

const RPC_ENDPOINT = "https://api.devnet.solana.com";
const umi = createUmi(RPC_ENDPOINT);

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const myKeypairSigner = createSignerFromKeypair(umi, keypair);
umi.use(signerIdentity(myKeypairSigner));
umi.use(mplTokenMetadata());

const mint = generateSigner(umi);

(async () => {
  let tx = createNft(umi, {
    mint,
    name: "sourav",
    symbol: "SOURAV",
    uri: "https://gateway.irys.xyz/J6qU9cjN5PReyFDRTz5XokMuR9iNC4HNrqnyYCq8Hpad",
    sellerFeeBasisPoints: percentAmount(5),
  });
  let result = await tx.sendAndConfirm(umi);
  const signature = base58.encode(result.signature);

  console.log(
    `Succesfully Minted! Check out your TX here:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`
  );

  console.log("Mint Address: ", mint.publicKey);
})();

// https://explorer.solana.com/tx/3Agj21yGL8DLJkygjxrDR1dEPyn52k8fj2KxaxtgCyzDT4wKEi1JDWZQ5MQE8LnkNhx6MFoyuPo1wzEwrBnRq7ch?cluster=devnet
// Mint Address:  F6C87xVk45Zf9j2yPjEzFn41AQQPBL2gW4awo7QWcK4M
