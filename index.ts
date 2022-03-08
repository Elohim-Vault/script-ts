
// Import * as anchor not working...
const anchor = require("@project-serum/anchor");

import { Provider, Program, web3 } from "@project-serum/anchor";
import { readFileSync } from "fs";
import * as spl from "@solana/spl-token";
import minimist from 'minimist';


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
    const idoTokenIdoAmount = new anchor.BN(5000000);
    const stableCoinMintAccount = await createMint(provider, provider.wallet.publicKey);
    const idoTokenMintAccount = await createMint(provider, provider.wallet.publicKey);
    const stableCoinMint = stableCoinMintAccount.publicKey;
    const idoTokenMint = idoTokenMintAccount.publicKey;
    const idoAuthorityIdoToken = await createTokenAccount(
        provider,
        idoTokenMint,
        provider.wallet.publicKey
    );
    await idoTokenMintAccount.mintTo(
        idoAuthorityIdoToken,
        provider.wallet.publicKey,
        [],
        idoTokenIdoAmount.toString()
    );

    const idoName = "ido";
    const [idoAccount, idoAccountBump] =
        await web3.PublicKey.findProgramAddress(
            [Buffer.from(idoName)],
            program.programId
        );


    const rules = [];

    const [poolIdoToken, poolIdoTokenBump] =
        await web3.PublicKey.findProgramAddress(
            [Buffer.from(idoName), Buffer.from("pool_ido_token")],
            program.programId
        );


    const [poolStableCoin, poolStableCoinBump] =
        await web3.PublicKey.findProgramAddress(
            [Buffer.from(idoName), Buffer.from("pool_stable_coin")],
            program.programId
        );

    const nowBn = new anchor.BN(Date.now() / 1000);
    const bn_20 = nowBn.add(new anchor.BN(5));
    const bn_5 = nowBn.add(new anchor.BN(15));
    const bn_time = nowBn.add(new anchor.BN(5));

    const rule = `${nowBn};${100}`;
    rules.push(rule);

    await program.rpc.initializePool(
        idoName,
        idoTokenIdoAmount,
        bn_time,
        10,
        0,
        bn_20,
        bn_5,
        { idoAccount, poolIdoToken, poolStableCoin },
        4,
        4,
        25,
        {
            accounts: {
                idoAuthority: provider.wallet.publicKey,
                idoAuthorityIdoToken,
                idoAccount,
                stableCoinMint,
                idoTokenMint,
                poolIdoToken,
                poolStableCoin,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: spl.TOKEN_PROGRAM_ID,
                rent: web3.SYSVAR_RENT_PUBKEY,
            },
        }
    );

    const state = await program.account.idoData.fetch(idoAccount);
    console.log(state.idoAuthority.toString());
}
(async () => {
    const args = minimist(process.argv.slice(2));
    const secret = JSON.parse(readFileSync(args.address, 'utf-8'));
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