/**
 * Code from NOMP
 */

import * as Utils from '../misc/Utils';

export default class MerkleTree {
    data: Buffer[];
    steps: Buffer[];
    root: Buffer;

    constructor(data: Buffer[]) {
        this.data = data;
        this.steps = this.calculateSteps(data);
        this.root = this.calculateRoot(data[0] == null ? data.slice(1) : data);
    }

    static merkleJoin(h1: Buffer, h2: Buffer) {
        let joined = Buffer.concat([h1, h2]);
        return Utils.sha256d(joined);
    }

    getMerkleHashes() {
        return this.steps.map(step => step.toString('hex'));
    }

    /**
     * Used to calculate the steps for adding a coinbase later
     * Collapse all leaves 
     * Compute the black points in this picture http://7fvhfe.com1.z0.glb.clouddn.com/wp-content/uploads/2016/11/p5.png
     * @param data The first item is required to be null
     */
    calculateSteps(data: Buffer[]) {
        let L = data;
        let steps: Buffer[] = [];
        let PreL = [null];
        let StartL = 2;
        let Ll = L.length;
        let me = this;

        if (Ll > 1) {
            while (true) {

                if (Ll === 1)
                    break;

                steps.push(L[1]);

                if (Ll % 2)
                    L.push(L[L.length - 1]);

                let Ld = [];
                let r = Utils.range(StartL, Ll, 2);
                r.forEach(i => Ld.push(MerkleTree.merkleJoin(L[i], L[i + 1])));
                L = PreL.concat(Ld);
                Ll = L.length;
            }
        }
        return steps;
    }

    // Used to calculate merkle root without adding a coinbase later
    calculateRoot(_data: Buffer[]): Buffer {
        let data = _data; // We dont want to work in-place
        // This is a recursive function
        if (data.length > 1) {
            if (data.length % 2 !== 0)
                data.push(data[data.length - 1]);
            // Hash
            let newData = [];
            for (let i = 0; i < data.length; i += 2) newData.push(MerkleTree.merkleJoin(data[i], data[i + 1]));
            return this.calculateRoot(newData);
        }

        return data[0];
    }

    /**
    *  Calculate all nodes to one hash
    *  @param first coinbase
    */
    withFirst(f: Buffer) {
        this.steps.forEach(s => f = Utils.sha256d(Buffer.concat([f, s])));
        return f;
    }

    getHashProof(h: Buffer) {
        let data = this.data;
        if (data.length == 1) return Buffer.concat([Utils.varIntBuffer(0), Utils.packInt32LE(0)]);

        let ind = data.indexOf(h);
        if (ind < 0) return undefined; // Cant prove; it is not part of this merkle tree

        let branch_len = 0;
        let hash_buffer = new Buffer(0);
        let side_mask;

        for (; data.length > 1; branch_len++) {
            if (data.length % 2 !== 0)
                data.push(data[data.length - 1]);
            if (ind % 2 === 0) {
                // We need right side
                Buffer.concat([hash_buffer, data[ind + 1]]);
                // No need to write side mask because it should already be 0
            }
            else {
                // We need left side
                Buffer.concat([hash_buffer, data[ind - 1]]);
                side_mask = side_mask & (1 << branch_len);
            }
            // Calculate the next level of the merkle root.
            let newData = [];
            for (let i = 0; i < data.length; i += 2) newData.push(MerkleTree.merkleJoin(data[i], data[i + 1]));
            data = newData;
            ind = Math.floor(ind / 2);
        }
        branch_len++;
        return Buffer.concat([Utils.varIntBuffer(branch_len), hash_buffer, Utils.serializeScriptSigNumber(side_mask)]);
    }

    static buildMerkleTree(auxData: any[]) {
        // Determine which slots the merkle hashes will go into in the merkle tree
        // Strategy derived from p2pool
        let size = 1;
        for (; size < Math.pow(2, 32); size *= 2) {
            if (size < auxData.length)
                continue;
            let res = new Array(size);
            for (let i = 0; i < size; i++)
                res[i] = Buffer.alloc(32, 0);
            let c = [];
            for (let i = 0; i < auxData.length; i++) {
                let pos = Utils.getAuxMerklePosition(auxData[i].chainid, size);
                if (c.indexOf(pos) != -1)
                    break;
                c.push(pos);
                let d = Utils.uint256BufferFromHash(auxData[i].hash);
                d.copy(res[pos]);
            }

            if (c.length == auxData.length) {
                // all coins added successfully to the tree, return a generated merkle tree
                let auxMerkleTree = new MerkleTree(res);
                return auxMerkleTree;
            }
        }
    }
}