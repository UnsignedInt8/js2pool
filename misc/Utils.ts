//
// SOURCE NOMP: https://github.com/zone117x/node-stratum-pool
// UNOMP: https://github.com/UNOMP/node-merged-pool
//

import * as crypto from 'crypto';
import * as base58 from 'base58-native';
import * as bignum from 'bignum';

export function addressFromEx(exAddress, ripdm160Key) {
    try {
        let versionByte = getVersionByte(exAddress);
        let addrBase = Buffer.concat([versionByte, Buffer.from(ripdm160Key, 'hex')]);
        let checksum = sha256d(addrBase).slice(0, 4);
        let address = Buffer.concat([addrBase, checksum]);
        return base58.encode(address);
    }
    catch (e) {
        return null;
    }
};


export function getVersionByte(addr: string) {
    let versionByte = base58.decode(addr).slice(0, 1);
    return versionByte;
};

export function sha256(buffer: Buffer) {
    let hash1 = crypto.createHash('sha256');
    hash1.update(buffer);
    return hash1.digest();
};

export function sha256d(buffer: Buffer) {
    return sha256(sha256(buffer));
};

export function reverseBuffer(buff: Buffer) {
    let reversed = Buffer.alloc(buff.length);
    for (let i = buff.length - 1; i >= 0; i--)
        reversed[buff.length - i - 1] = buff[i];
    return reversed;
};

export function reverseHex(hex: string) {
    return reverseBuffer(Buffer.from(hex, 'hex')).toString('hex');
};

export function reverseByteOrder(buff: Buffer) {
    for (let i = 0; i < 8; i++) buff.writeUInt32LE(buff.readUInt32BE(i * 4), i * 4);
    return reverseBuffer(buff);
};

// rpc bytes order to internal bytes order
export function uint256BufferFromHash(hex: string) {

    let fromHex = Buffer.from(hex, 'hex');

    if (fromHex.length != 32) {
        let empty = Buffer.alloc(32, 0);
        fromHex.copy(empty);
        fromHex = empty;
    }

    return reverseBuffer(fromHex);
};

export function stringToReversedBuffer(str: string, encoding = 'hex') {
    let buf = Buffer.from(str);
    return reverseBuffer(buf);
}

/**
 * internal bytes order to rpc bytes order http://bitcoin.stackexchange.com/questions/32765/how-do-i-calculate-the-txid-of-this-raw-transaction
 * so, it can be transfered on the internet
 * @param buffer 
 */
export function hexFromReversedBuffer(buffer: Buffer) {
    return reverseBuffer(buffer).toString('hex');
};

export function getAuxMerklePosition(chain_id: number, size: number) {
    return (1103515245 * chain_id + 1103515245 * 12345 + 12345) % size;
}


/*
Defined in bitcoin protocol here:
 https://en.bitcoin.it/wiki/Protocol_specification#Variable_length_integer
 */
export function varIntBuffer(n: number) {
    if (n < 0xfd)
        return Buffer.from([n]);
    else if (n < 0xffff) {
        let buff = Buffer.alloc(3);
        buff[0] = 0xfd;
        buff.writeUInt16LE(n, 1);
        return buff;
    }
    else if (n < 0xffffffff) {
        let buff = Buffer.alloc(5);
        buff[0] = 0xfe;
        buff.writeUInt32LE(n, 1);
        return buff;
    }
    else {
        let buff = Buffer.alloc(9);
        buff[0] = 0xff;
        packUInt16LE(n).copy(buff, 1);
        return buff;
    }
};

export function varBufferInt(data: Buffer): number {
    let first = data.readUInt8(0);

    if (first < 0xfd) {
        return data.readUInt8(0);
    } else if (first === 0xfd) {
        return data.readUInt16LE(1);
    } else if (first === 0xfe) {
        return data.readUInt32LE(1);
    } else if (first === 0xff) {
        return bignum.fromBuffer(data.slice(1), { endian: 'little', size: 8 }).toNumber();
    }

    return 0;
}

export function varBufferIntLength(data: Buffer) {
    let first = data.readUInt8(0);
    let offset = 0;
    let size = 0;
    let value = 0;

    if (first < 0xfd) {
        offset = 0;
        size = 1;
        value = first;
    } else if (first === 0xfd) {
        offset = 1;
        size = 2;
        value = data.readUInt16LE(1);
    } else if (first === 0xfe) {
        offset = 1;
        size = 4;
        value = data.readUInt32LE(1);
    } else if (first === 0xff) {
        offset = 1;
        size = 8;
        value = bignum.fromBuffer(data.slice(1, 9), { endian: 'little', size: 8 }).toNumber();
    }

    return { value, offset, size };
}

export function varIntLength(data: Buffer) {
    let first = data.readUInt8(0);
    let start = 0;
    let length = 0;

    if (first < 0xfd) {
        start = 0;
        length = 1;
    } else if (first === 0xfd) {
        start = 1;
        length = 2;
    } else if (first === 0xfe) {
        start = 1;
        length = 4;
    } else if (first === 0xff) {
        start = 1;
        length = 8;
    }

    return { start, length };
}

export function varStringBuffer(string: string, encoding = 'utf8') {
    let strBuff = Buffer.from(string, encoding);
    return Buffer.concat([varIntBuffer(strBuff.length), strBuff]);
};

export function varStringLength(buf: Buffer) {
    let offset = 1;
    let size = buf.readUInt8(0);

    // See varIntBuffer, each 'length' has a different bytes
    switch (buf.readUInt8(0)) {
        case 0xfd:
            offset = 3;
            break;
        case 0xfe:
            offset = 5;
            break;
        case 0xff:
            offset = 9;
            break;
    }

    switch (size) {
        case 0xfd:
            size = buf.readUInt16LE(1);
            break;
        case 0xfe:
            size = buf.readUInt32LE(1);
            break;
        case 0xff:
            let second = buf.readUInt32LE(1);
            let first = buf.readUInt32LE(5);
            size = (first * 0x100000000) + second;
            break;
    }

    return { offset, size };
}

export function varBufferString(buf: Buffer, decoding = 'utf8') {
    let { offset, size } = varStringLength(buf);
    return buf.slice(offset, offset + size).toString(decoding);
}

export function varBufferStringLength(buf: Buffer, decoding = 'utf8') {
    let { offset, size } = varStringLength(buf);
    let value = buf.slice(offset, offset + size).toString(decoding);
    return { value, offset, size };
}

/*
"serialized CScript" formatting as defined here:
 https://github.com/bitcoin/bips/blob/master/bip-0034.mediawiki#specification
Used to format height and date when putting into script signature:
 https://en.bitcoin.it/wiki/Script
 */
export function serializeScriptSigNumber(n: number) {

    //New version from TheSeven
    if (n >= 1 && n <= 16) return Buffer.from([0x50 + n]);
    let l = 1;
    let buff = Buffer.alloc(9);
    while (n > 0x7f) {
        buff.writeUInt8(n & 0xff, l++);
        n >>= 8;
    }
    buff.writeUInt8(l, 0);
    buff.writeUInt8(n, l++);
    return buff.slice(0, l);

};


/*
Used for serializing strings used in script signature
 */
export function serializeString(s: string) {

    if (s.length < 253)
        return Buffer.concat([
            Buffer.from([s.length]),
            Buffer.from(s)
        ]);
    else if (s.length < 0x10000)
        return Buffer.concat([
            Buffer.from([253]),
            packUInt16LE(s.length),
            Buffer.from(s)
        ]);
    else if (s.length < 0x100000000)
        return Buffer.concat([
            Buffer.from([254]),
            packUInt32LE(s.length),
            Buffer.from(s)
        ]);
    else
        return Buffer.concat([
            Buffer.from([255]),
            packUInt16LE(s.length),
            Buffer.from(s)
        ]);
};



export function packUInt8(num: number) {
    let buf = Buffer.alloc(1);
    buf.writeUInt8(num, 0);
    return buf;
}
export function packUInt16LE(num: number) {
    let buff = Buffer.alloc(2);
    buff.writeUInt16LE(num, 0);
    return buff;
};
export function packInt32LE(num: number) {
    let buff = Buffer.alloc(4);
    buff.writeInt32LE(num, 0);
    return buff;
};
export function packInt32BE(num: number) {
    let buff = Buffer.alloc(4);
    buff.writeInt32BE(num, 0);
    return buff;
};
export function packUInt32LE(num: number) {
    let buff = Buffer.alloc(4);
    buff.writeUInt32LE(num, 0);
    return buff;
};
export function packUInt32BE(num: number) {
    let buff = Buffer.alloc(4);
    buff.writeUInt32BE(num, 0);
    return buff;
};
export function packInt64LE(num: number) {
    let buff = Buffer.alloc(8);
    buff.writeUInt32LE(num % Math.pow(2, 32), 0);
    buff.writeUInt32LE(Math.floor(num / Math.pow(2, 32)), 4);
    return buff;
};


/*
An exact copy of python's range feature. Written by Tadeck:
 http://stackoverflow.com/a/8273091
 */
export function range(start: number, stop: number, step: number) {
    if (typeof stop === 'undefined') {
        stop = start;
        start = 0;
    }
    if (typeof step === 'undefined') {
        step = 1;
    }
    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }
    let result: number[] = [];
    for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }
    return result;
};




/*
 For POS coins - used to format wallet address for use in generation transaction's output
 */
export function posPubkeyToScript(key: string) {
    if (key.length !== 66) {
        console.error('Invalid pubkey: ' + key);
        throw new Error();
    }
    let pubkey = Buffer.alloc(35);
    pubkey[0] = 0x21;
    pubkey[34] = 0xac;
    Buffer.from(key, 'hex').copy(pubkey, 1);
    return pubkey;
};


export function hash160ToScript(key: string) {
    let keyBuffer = Buffer.from(key, 'hex');
    return Buffer.concat([Buffer.from([0x76, 0xa9, 0x14]), keyBuffer, Buffer.from([0x88, 0xac])]);
};

/*
For POW coins - used to format wallet address for use in generation transaction's output
 */
export function addressToScript(addr: string) {

    let decoded: Buffer = base58.decode(addr);

    if (decoded.length != 25) {
        console.error('invalid address length for ' + addr);
        throw new Error();
    }

    if (!decoded) {
        console.error('base58 decode failed for ' + addr);
        throw new Error();
    }

    let pubkey = decoded.slice(1, -4);

    return Buffer.concat([new Buffer([0x76, 0xa9, 0x14]), pubkey, new Buffer([0x88, 0xac])]);
};

export function addressToPubkey(addr: string) {
    let decoded: Buffer = base58.decode(addr);
    return decoded.slice(1, -4);
}

export function pubkeyToAddress(pubkey: string, net = '00') {
    let checksum = sha256d(Buffer.from(net + pubkey, 'hex')).slice(0, 4).toString('hex');
    return base58.encode(Buffer.from(net + pubkey + checksum, 'hex'));
}


export function getReadableHashRateString(hashrate: number) {
    let i = -1;
    let byteUnits = [' KH', ' MH', ' GH', ' TH', ' PH'];
    do {
        hashrate = hashrate / 1024;
        i++;
    } while (hashrate > 1024);
    return hashrate.toFixed(2) + byteUnits[i];
};




//Creates a non-truncated max difficulty (baseDiff) by bitwise right-shifting the max value of a uint256
export function shiftMax256Right(shiftRight) {

    //Max value uint256 (an array of ones representing 256 enabled bits)
    let arr256 = Array.apply(null, new Array(256)).map(Number.prototype.valueOf, 1);

    //An array of zero bits for how far the max uint256 is shifted right
    let arrLeft = Array.apply(null, new Array(shiftRight)).map(Number.prototype.valueOf, 0);

    //Add zero bits to uint256 and remove the bits shifted out
    arr256 = arrLeft.concat(arr256).slice(0, 256);

    //An array of bytes to convert the bits to, 8 bits in a byte so length will be 32
    let octets = [];

    for (let i = 0; i < 32; i++) {

        octets[i] = 0;

        //The 8 bits for this byte
        let bits = arr256.slice(i * 8, i * 8 + 8);

        //Bit math to add the bits into a byte
        for (let f = 0; f < bits.length; f++) {
            let multiplier = Math.pow(2, f);
            octets[i] += bits[f] * multiplier;
        }

    }

    return new Buffer(octets);
};


export function bufferToCompactBits(startingBuff: Buffer) {
    let bigNum = bignum.fromBuffer(startingBuff);
    let buff = bigNum.toBuffer();

    buff = buff.readUInt8(0) > 0x7f ? Buffer.concat([Buffer.from([0x00]), buff]) : buff;

    buff = Buffer.concat([new Buffer([buff.length]), buff]);
    let compact = buff.slice(0, 4);
    return compact;
};

/*
 Used to convert getblocktemplate bits field into target if target is not included.
 More info: https://en.bitcoin.it/wiki/Target
 */

export function bignumFromBitsBuffer(bitsBuff: Buffer) {
    let numBytes = bitsBuff.readUInt8(0);
    let bigBits = bignum.fromBuffer(bitsBuff.slice(1));
    let target = bigBits.mul(
        new bignum(2).pow(
            new bignum(8).mul(
                numBytes - 3
            )
        )
    );
    return target;
};

export function bignumFromBitsHex(bitsString: string) {
    let bitsBuff = Buffer.from(bitsString, 'hex');
    return bignumFromBitsBuffer(bitsBuff);
};

export function convertBitsToBuff(bitsBuff: Buffer) {
    let target = bignumFromBitsBuffer(bitsBuff);
    let resultBuff = target.toBuffer();
    let buff256 = Buffer.alloc(32, 0);
    resultBuff.copy(buff256, buff256.length - resultBuff.length);
    return buff256;
};

export function getTruncatedDiff(shift) {
    return convertBitsToBuff(bufferToCompactBits(shiftMax256Right(shift)));
};
