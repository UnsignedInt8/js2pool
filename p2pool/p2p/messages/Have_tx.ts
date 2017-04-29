/*
 * Created on Mon Apr 10 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import * as utils from '../../../misc/Utils';
import { Payload } from "./Payload";

export type TypeHave_tx = {
    txHashes: string[]
}

export class Have_tx extends Payload {
    txHashes: string[];

    toBuffer() {
        let hashes = this.txHashes.map(h => utils.uint256BufferFromHash(h));
        hashes.unshift(utils.varIntBuffer(this.txHashes.length));
        return Buffer.concat(hashes);
    }

    static fromObject(obj: TypeHave_tx): Have_tx {
        let tx = new Have_tx();
        tx.txHashes = obj.txHashes;
        return tx;
    }

    static fromBuffer(data: Buffer): Have_tx {
        let { value: count, offset: start, size } = utils.varBufferIntLength(data);
        let payload = data.slice(start + size);
        let offset = 0;
        let hashes = new Array<string>();

        while (offset < payload.length) {
            let hash = payload.slice(offset, offset + 32);
            hashes.push(utils.hexFromReversedBuffer(hash));
            offset += 32;
        }

        let haveTx = new Have_tx();
        haveTx.txHashes = hashes;
        return haveTx;
    }
}

export class Losingtx extends Have_tx {

}

export class Forgettx extends Have_tx {

}