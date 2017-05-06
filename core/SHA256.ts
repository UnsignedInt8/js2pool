import * as BigNum from 'bignum';

const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const bignumK = k.map(i => new BigNum(i));

const INT_MAX = 2 ** 32;

// https://wiki.python.org/moin/BitwiseOperators
function rightrotate(x, n) {
    return new BigNum(x).shiftRight(n).or(new BigNum(x).shiftLeft(32 - n).mod(INT_MAX));
}

function process(state: Buffer, chunk: Buffer) {

    let w = new Array<BigNum>();
    for (let i = 0; i < chunk.length; i += 4) {
        w.push(new BigNum(chunk.readUInt32BE(i)));
    }

    for (let i = 16; i < 64; i++) {
        let s0 = rightrotate(w[i - 15], 7).xor(rightrotate(w[i - 15], 18)).xor(new BigNum(w[i - 15]).shiftRight(3));
        let s1 = rightrotate(w[i - 2], 17).xor(rightrotate(w[i - 2], 19)).xor(new BigNum(w[i - 2]).shiftRight(10));
        w.push((w[i - 16].add(s0).add(w[i - 7]).add(s1).mod(INT_MAX)));
    }

    let startState = new Array<BigNum>();
    for (let i = 0; i < state.length; i += 4) {
        startState.push(new BigNum(state.readUInt32BE(i)));
    }

    let [a, b, c, d, e, f, g, h] = startState;
    for (let [k_i, w_i] of bignumK.zip<BigNum>(w)) {

        let t1 = (h.add(rightrotate(e, 6).xor(rightrotate(e, 11)).xor(rightrotate(e, 25))).add((e.and(f)).xor(e.mul(-1).sub(1).and(g))).add(k_i).add(w_i)).mod(INT_MAX);

        let tmp = [
            (t1.add(rightrotate(a, 2).xor(rightrotate(a, 13)).xor(rightrotate(a, 22))).add((a.and(b)).xor(a.and(c)).xor(b.and(c)))).mod(INT_MAX),
            a,
            b,
            c,
            d.add(t1).mod(INT_MAX),
            e,
            f,
            g
        ];

        a = tmp[0];
        b = tmp[1];
        c = tmp[2];
        d = tmp[3];
        e = tmp[4];
        f = tmp[5];
        g = tmp[6];
        h = tmp[7];
    }

    let finalState = Buffer.alloc(32);
    startState.zip<number, number>([a, b, c, d, e, f, g, h], (i1, i2) => i1.add(i2).mod(INT_MAX).toNumber()).each((item, index) => finalState.writeUInt32BE(item, index * 4));

    return finalState;
}

// http://www.jianshu.com/p/452c1a5acd31
function floorMod(a: number, b: number) {
    return a - Math.floor(a / b) * b;
}

export default class SHA256 {

    static readonly digestSize = 256 / 8;
    static readonly blockSize = 512 / 8;

    state = Buffer.from('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19', 'hex');
    buf: Buffer;
    length: number;

    constructor(data: Buffer = Buffer.alloc(0), initState: Buffer = null, initData = Buffer.alloc(0), initLength = 0) {
        this.state = initState || this.state;
        this.buf = initData;
        this.length = initLength;
        this.update(data);
    }

    update(data: Buffer) {
        let state = this.state;
        let buf = Buffer.concat([this.buf, data]);

        let chunks = new Array<Buffer>();
        for (let i = 0; i < buf.length + 1; i += SHA256.blockSize) {
            chunks.push(buf.slice(i, i + SHA256.blockSize));
        }

        for (let chunk of chunks.take(chunks.length - 1)) {
            state = process(state, chunk);
        }

        this.state = state;
        this.buf = chunks[chunks.length - 1];
        this.length += 8 * data.length;
    }

    digest() {
        let state = this.state;
        let buf = Buffer.concat([this.buf, Buffer.from('80', 'hex'), Buffer.alloc(floorMod(SHA256.blockSize - 9 - this.buf.length, SHA256.blockSize), 0), new BigNum(this.length).toBuffer({ endian: 'big', size: 8 })]);

        let chunks = new Array<Buffer>();
        for (let i = 0; i < buf.length; i += SHA256.blockSize) {
            chunks.push(buf.slice(i, i + SHA256.blockSize));
        }

        for (let chunk of chunks) {
            state = process(state, chunk);
        }

        return state;
    }

    digestHex() {
        return this.digest().toString('hex');
    }
}