import * as Utils from '../misc/Utils';
import * as crypto from 'crypto';
import { GetBlockTemplate } from "./DaemonWatcher";
import MerkleTree from "./MerkleTree";

export type Task = {
    coinbaseTx: { part1: Buffer, part2: Buffer },
    stratumParams: (string | boolean | string[])[],
    taskId: string,
    previousBlockHash: string,
    merkleLink: Buffer[],
    height: number,
};

export class TaskConstructor {
    private poolPubkeyScript: Buffer;
    private fees = new Array<{ pubkeyScript: Buffer, percent: number }>();

    extraNonceSize = 8;
    txMessageRequired = false;
    proof: 'POW' | 'POS' = 'POW';

    constructor(poolAddr: string, fees?: { address: string, percent: number }[], proof: 'POW' | 'POS' = 'POW') {
        const me = this;
        const addrToScript = proof === 'POW' ? Utils.addressToScript : Utils.posPubkeyToScript;

        me.proof = proof;
        me.poolPubkeyScript = addrToScript(poolAddr);
        if (!fees) return;

        this.fees = fees.map(recipient => {
            return {
                percent: recipient.percent / 100,
                pubkeyScript: recipient.address.length === 40 ? Utils.hash160ToScript(recipient.address) : Utils.addressToScript(recipient.address)
            }
        });
    }

    /**
     * Create stratum mining job params
     * @param template RPC getblocktemplate
     * @param auxMerkleRoot 
     * @param auxMerkleSize 
     */
    buildTask(template: GetBlockTemplate, auxMerkleRoot: Buffer, auxMerkleSize: number): Task {
        let coinbaseTx = this.buildGenerationTx(template, auxMerkleRoot, auxMerkleSize);
        let taskId = crypto.randomBytes(4).toString('hex');
        let merkleLink = (new MerkleTree([null].concat(template.transactions.map(tx => Utils.uint256BufferFromHash(tx.txid ? tx.txid : tx.hash))))).steps;

        let stratumParams = [
            taskId,
            Utils.reverseByteOrder(Buffer.from(template.previousblockhash, 'hex')).toString('hex'),
            coinbaseTx.part1.toString('hex'),
            coinbaseTx.part2.toString('hex'),
            merkleLink.map(item => item.toString('hex')),
            Utils.packUInt32BE(template.version).toString('hex'),
            template.bits,
            Utils.packUInt32BE(template.curtime).toString('hex'),
            true, // Force to start new task
        ];

        return { coinbaseTx, stratumParams, taskId, merkleLink, previousBlockHash: template.previousblockhash, height: template.height };
    }

    debugTxTime: number;
    private buildGenerationTx(template: GetBlockTemplate, auxMerkleRoot: Buffer = Buffer.alloc(0), auxMerkleSize: number = 0) {
        let coinbaseScriptSig1 = Buffer.concat([
            Utils.serializeScriptSigNumber(template.height),
            Buffer.from(template.coinbaseaux.flags, 'hex'),
            Utils.serializeScriptSigNumber(this.debugTxTime || Date.now() / 1000 | 0),
            Utils.packUInt8(Math.min(this.extraNonceSize, 255)),// extra nonce size
            Buffer.from('fabe6d6d', 'hex'), // aux magic
            Utils.reverseBuffer(auxMerkleRoot), // aux block hash 
            Utils.packUInt32LE(auxMerkleSize), // aux count
            Utils.packUInt32LE(0), // aux id
        ]);

        let coinbaseScriptSig2 = Utils.serializeString('Mined by Rice');

        let txOutputs = this.buildOutputs(template);

        let txVersion = this.txMessageRequired ? 2 : 1;
        let txComment = this.txMessageRequired ? Utils.serializeString('Mined by Rice') : Buffer.alloc(0);
        let txTimestamp = this.proof === 'POS' ? Utils.packUInt32LE(template.curtime) : Buffer.alloc(0);
        const txInputsCount = 1;
        const txPreviousOutputHash = '00';
        const txInPrevOutIndex = Math.pow(2, 32) - 1;

        let tx1 = Buffer.concat([
            Utils.packUInt32LE(txVersion),
            txTimestamp,

            // Tx Inputs
            Utils.varIntBuffer(txInputsCount),
            Utils.uint256BufferFromHash(txPreviousOutputHash),
            Utils.packUInt32LE(txInPrevOutIndex),
            Utils.varIntBuffer(coinbaseScriptSig1.length + this.extraNonceSize + coinbaseScriptSig2.length),
            coinbaseScriptSig1,
        ]);

        // ***
        // Extra nonce area...
        // ***

        let tx2 = Buffer.concat([
            coinbaseScriptSig2,
            Utils.packUInt32LE(0),  // Tx input sequence

            txOutputs,

            Utils.packUInt32LE(0), // Tx lock time
            txComment
        ]);

        return { part1: tx1, part2: tx2 };
    }

    private buildOutputs(template: GetBlockTemplate) {
        let total = template.coinbasevalue;
        let rewardToPool = total;
        let txOutputsPubkeyScripts = new Array<Buffer>();

        /* Dash 12.1 */
        if (template.masternode && template.superblock) {
            if (template.masternode.payee) {
                let payeeReward = 0;

                payeeReward = template.masternode.amount;
                total -= payeeReward;
                rewardToPool -= payeeReward;

                let payeeScript = Utils.addressToScript(template.masternode.payee);
                txOutputsPubkeyScripts.push(Buffer.concat([
                    Utils.packInt64LE(payeeReward),
                    Utils.varIntBuffer(payeeScript.length),
                    payeeScript
                ]));
            } else if (template.superblock.length > 0) {
                for (let i in template.superblock) {
                    let payeeReward = 0;

                    payeeReward = template.superblock[i].amount;
                    total -= payeeReward;
                    rewardToPool -= payeeReward;

                    let payeeScript = Utils.addressToScript(template.superblock[i].payee);
                    txOutputsPubkeyScripts.push(Buffer.concat([
                        Utils.packInt64LE(payeeReward),
                        Utils.varIntBuffer(payeeScript.length),
                        payeeScript
                    ]));
                }
            }
        }

        if (template.payee) {
            let payeeReward = 0;

            if (template.payee_amount) {
                payeeReward = template.payee_amount;
            } else {
                payeeReward = Math.ceil(total / 5);
            }

            total -= payeeReward;
            rewardToPool -= payeeReward;

            let payeeScript = Utils.addressToScript(template.payee);
            txOutputsPubkeyScripts.push(Buffer.concat([
                Utils.packInt64LE(payeeReward),
                Utils.varIntBuffer(payeeScript.length),
                payeeScript
            ]));
        }

        for (let i = 0; i < this.fees.length; i++) {
            let recipientReward = Math.floor(this.fees[i].percent * total);
            rewardToPool -= recipientReward;

            txOutputsPubkeyScripts.push(Buffer.concat([
                Utils.packInt64LE(recipientReward),
                Utils.varIntBuffer(this.fees[i].pubkeyScript.length),
                this.fees[i].pubkeyScript
            ]));
        }

        txOutputsPubkeyScripts.unshift(Buffer.concat([
            Utils.packInt64LE(rewardToPool),
            Utils.varIntBuffer(this.poolPubkeyScript.length),
            this.poolPubkeyScript
        ]));

        // https://bitcointalk.org/index.php?topic=1676471.0;prev_next=prev
        if (template.default_witness_commitment !== undefined) {
            let witness_commitment = Buffer.from(template.default_witness_commitment, 'hex');
            txOutputsPubkeyScripts.unshift(Buffer.concat([
                Utils.packInt64LE(0),
                Utils.varIntBuffer(witness_commitment.length),
                witness_commitment
            ]));
        }

        return Buffer.concat([
            Utils.varIntBuffer(txOutputsPubkeyScripts.length),
            Buffer.concat(txOutputsPubkeyScripts)
        ]);
    }

}

export type Recipient = {
    script: Buffer,
    percent: number, // Reward value, percent unit
}