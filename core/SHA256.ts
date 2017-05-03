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

function rightrotate(x: number, n: number) {
    return (x >> n) | (x << 32 - n) % 2 ** 32;
}

function process(state: Buffer, chunk: Buffer) {

    let w = new Array<number>();
    for (let i = 0; i < chunk.length; i += 4) {
        w.push(chunk.readUInt32BE(i));
    }

    for (let i = 16; i < 64; i++) {
        let s0 = rightrotate(w[i - 15], 7) ^ rightrotate(w[i - 15], 18) ^ (w[i - 15] >> 3)
        let s1 = rightrotate(w[i - 2], 17) ^ rightrotate(w[i - 2], 19) ^ (w[i - 2] >> 10)
        w.push((w[i - 16] + s0 + w[i - 7] + s1) % 2 ** 32)
    }

    let startState = new Array<number>();
    for (let i = 0; i < state.length; i += 4) {
        startState.push(state.readUInt32BE(i));
    }
    let [a, b, c, d, e, f, g, h] = startState;

    for (let [k_i, w_i] of k.zip<number>(w)) {
        let t1 = (h + (rightrotate(e, 6) ^ rightrotate(e, 11) ^ rightrotate(e, 25)) + ((e & f) ^ (~e & g)) + k_i + w_i) % 2 ** 32

        a = (t1 + (rightrotate(a, 2) ^ rightrotate(a, 13) ^ rightrotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) % 2 ** 32;
        b = a;
        c = b;
        d = c;
        e = (d + t1) % 2 ** 32;
        f = e;
        g = f;
        h = g;
    }

    let result = Buffer.alloc(32);
    startState.zip<number, number>([a, b, c, d, e, f, g, h], (i1, i2) => (i1 + i2) % 2 ** 32).each((item, index) => result.writeUInt32BE(item, index * 4));

    return result;
}

export default class SHA256 {

    static readonly digestSize = 256 / 8;
    static readonly blockSize = 512 / 8;

    state = Buffer.from('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19', 'hex');
    buf: Buffer;
    length = 0;

    constructor(data: Buffer = Buffer.alloc(0), initState: Buffer = null, initData = Buffer.alloc(0), length = 0) {
        this.state = initState || this.state;
        this.buf = initData;
        this.length = length;
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
        let buf = Buffer.concat([this.buf, Buffer.from('0x80', 'hex'), Buffer.alloc((SHA256.blockSize - 9 - this.buf.length) % SHA256.blockSize, 0), new BigNum(this.length).toBuffer({ endian: 'big', size: 8 })])
    }
}