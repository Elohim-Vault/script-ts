
// Import * as anchor not working...
const anchor = require("@project-serum/anchor");

import { Provider, Program, web3, BN } from "@project-serum/anchor";
import { readFileSync, writeFile } from "fs";
import * as spl from "@solana/spl-token";

type initializeIdoPoolAccounts = {
    idoAuthority: web3.PublicKey,
    idoAuthorityIdoToken: web3.PublicKey,
    stableCoinMint: web3.PublicKey,
    idoTokenMint: web3.PublicKey,
}

type initializeIdoPoolParams = {
    idoName: string;
    tokenSupplyForSale: BN;
    startTime: BN;
    duration: number;
    rate: number;
    maxStableCoin: BN;
    minStableCoin: BN;
    stableCoinDecimal: number;
    idoTokenDecimal: number;
    rateDecimal: number;
    accounts: initializeIdoPoolAccounts;
}

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

function logAccounts(accounts: Object, idoName: string) {
    writeFile(`${idoName}-log.json`, JSON.stringify(accounts), (err) => {
        if (err) {
            throw err;
        }
        return true;
    });
}


async function initializeIdoPool(program: Program, params: initializeIdoPoolParams) {
    const [idoAccount, idoAccountBump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(params.idoName)],
        program.programId
    );

    const [poolIdoToken, poolIdoTokenBump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(params.idoName), Buffer.from("pool_ido_token")],
        program.programId
    );

    const [poolStableCoin, poolStableCoinBump] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(params.idoName), Buffer.from("pool_stable_coin")],
        program.programId
    );

    const bumps = {
        idoAccountBump,
        poolIdoTokenBump,
        poolStableCoinBump
    };

    const accounts = {
        idoAuthority: params.accounts.idoAuthority.toString(),
        idoAuthorityIdoToken: params.accounts.idoAuthorityIdoToken.toString(),
        idoAccount: idoAccount.toString(),
        stableCoinMint: params.accounts.stableCoinMint.toString(),
        idoTokenMint: params.accounts.idoTokenMint.toString(),
        poolIdoToken: poolIdoToken.toString(),
        poolStableCoin: poolStableCoin.toString(),
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    }

    logAccounts(accounts, params.idoName);
    await program.rpc.initializePool(
        params.idoName,
        params.tokenSupplyForSale,
        params.startTime,
        params.duration,
        params.rate,
        params.maxStableCoin,
        params.minStableCoin,
        bumps,
        params.stableCoinDecimal,
        params.idoTokenDecimal,
        params.rateDecimal,
        {
            accounts: {
                idoAuthority: params.accounts.idoAuthority,
                idoAuthorityIdoToken: params.accounts.idoAuthorityIdoToken,
                idoAccount,
                stableCoinMint: params.accounts.stableCoinMint,
                idoTokenMint: params.accounts.idoTokenMint,
                poolIdoToken,
                poolStableCoin,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: spl.TOKEN_PROGRAM_ID,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            }
        }
    );

}

// Client
function getProvider(keypair: web3.Keypair): Provider {
    const opts = anchor.Provider.defaultOptions();
    const connection = new web3.Connection("https://api.devnet.solana.com", opts.preflightCommitment);
    const walletWrapper = new anchor.Wallet(keypair);
    return new anchor.Provider(connection, walletWrapper, opts);
}

(async () => {
    const secret = JSON.parse(readFileSync('/home/jeronimo/config/solana/devnet-test.json', 'utf-8'));
    const walletKeypair = web3.Keypair.fromSecretKey(
        Uint8Array.from(secret)
    );
    const provider = getProvider(walletKeypair)
    anchor.setProvider(provider);
    const idl = JSON.parse(readFileSync("idl.json", "utf8"));
    const programId = new web3.PublicKey(idl.metadata.address)
    const program = new anchor.Program(idl, programId);
    const nowBn = new anchor.BN(Date.now() / 1000);

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
    const params = {
        idoName: "ido",
        tokenSupplyForSale: new anchor.BN(1000),
        startTime: nowBn.add(new anchor.BN(5)),
        duration: 10,
        rate: 0,
        maxStableCoin: nowBn.add(new anchor.BN(5)),
        minStableCoin: nowBn.add(new anchor.BN(15)),
        stableCoinDecimal: 4,
        idoTokenDecimal: 4,
        rateDecimal: 25,
        accounts: {
            idoAuthority: provider.wallet.publicKey,
            idoAuthorityIdoToken: idoAuthorityIdoToken,
            stableCoinMint: stableCoinMint,
            idoTokenMint: idoTokenMint,
        }
    }
    initializeIdoPool(program, params);
})()

