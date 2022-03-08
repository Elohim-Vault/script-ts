
// Import * as anchor not working...
const anchor = require("@project-serum/anchor");

import { Provider, Program, web3 } from "@project-serum/anchor";
import { readFileSync } from "fs";
import * as spl from "@solana/spl-token";


async function createMint(provider: any, authority: web3.PublicKey): Promise<spl.Token> {
    if (authority === undefined) {
        authority = provider.wallet.publicKey;
    }
    const mint = await spl.Token.createMint(
        provider.connection,
        provider.wallet.payer,
        authority,
        null,
        6,
        spl.TOKEN_PROGRAM_ID
    );
    return mint;
}

async function createTokenAccount(provider: any, mint: web3.PublicKey, owner: web3.PublicKey): Promise<web3.PublicKey> {
    const token = new spl.Token(
        provider.connection,
        mint,
        spl.TOKEN_PROGRAM_ID,
        provider.wallet.payer
    );
    const vault = await token.createAccount(owner);
    return vault;
}

function getProvider(keypair: web3.Keypair): Provider {
    const opts = anchor.Provider.defaultOptions();
    const connection = new web3.Connection("https://api.devnet.solana.com", opts.preflightCommitment);
    const walletWrapper = new anchor.Wallet(keypair);
    return new anchor.Provider(connection, walletWrapper, opts);
}

async function initializeIdoPool(program: Program, provider: Provider) {
    const idoName = "ido";
    const tokenSupplyForSale = new anchor.BN(1000);
    const nowBn = new anchor.BN(Date.now() / 1000);
    const startTime = nowBn.add(new anchor.BN(5));
    const duration = 10;
    const rate = 0;
    const maxStableCoin = nowBn.add(new anchor.BN(5));
    const minStableCoin = nowBn.add(new anchor.BN(15));

    const stableCoinDecimal = 4;
    const idoTokenDecimal = 4;
    const rateDecimal = 25;

    const idoTokenMint = (await createMint(
        provider,
        provider.wallet.publicKey
    )).publicKey

    const stableCoinMint = (await createMint(
        provider,
        provider.wallet.publicKey
    )).publicKey;

    const idoAuthorityIdoToken = await createTokenAccount(
        provider,
        idoTokenMint,
        provider.wallet.publicKey
        );
        console.log(idoAuthorityIdoToken.toString())

    const [idoAccount, idoAccountBump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(idoName)],
        program.programId
    );

    const [poolIdoToken, poolIdoTokenBump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(idoName), Buffer.from("pool_ido_token")],
        program.programId
    );

    const [poolStableCoin, poolStableCoinBump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(idoName), Buffer.from("pool_stable_coin")],
        program.programId
    );

    const bumps = {
        idoAccountBump,
        poolIdoTokenBump,
        poolStableCoinBump
    };

    await program.rpc.initializePool(
        idoName,
        tokenSupplyForSale,
        startTime,
        duration,
        rate,
        maxStableCoin,
        minStableCoin,
        bumps,
        stableCoinDecimal,
        idoTokenDecimal,
        rateDecimal,
        {
            accounts: {
                idoAuthority: provider.wallet.publicKey,
                idoAuthorityIdoToken,
                idoAccount,
                stableCoinMint,
                idoTokenMint,
                poolIdoToken,
                poolStableCoin,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: spl.TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            }
        }
    );

}
(async () => {
    const secret = JSON.parse(readFileSync('/home/jeronimo/config/solana/devnet-test.json', 'utf-8'));
    const walletKeypair = web3.Keypair.fromSecretKey(
        Uint8Array.from(secret)
    );
    const provider = getProvider(walletKeypair)
    anchor.setProvider(provider);
    const idl = JSON.parse(readFileSync("ido.json", "utf8"));
    const programId = new web3.PublicKey(idl.metadata.address)
    const program = new anchor.Program(idl, programId);
    initializeIdoPool(program, provider)
})()