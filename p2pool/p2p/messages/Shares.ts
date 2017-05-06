/*
 * Created on Wed Apr 12 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";
import { BaseShare, Share, NewShare } from "../shares/index";
import * as utils from '../../../misc/Utils';
import BufferReader from "../../../misc/BufferReader";
import BufferWriter from "../../../misc/BufferWriter";

export type TypeShares = {
    version: number,
    contents: Share | NewShare,
}

/**
 * message_shares = pack.ComposedType([
        ('shares', pack.ListType(p2pool_data.share_type)),
    ])
 */
export class Shares extends Payload {
    shares: {
        version: number, // var int
        contents: Share | NewShare, // nullable, check it before using
    }[] = [];

    toBuffer() {
        return BufferWriter.writeList(this.shares.map(s => {
            let contentsBuf = s.contents.toBuffer();

            return Buffer.concat([
                BufferWriter.writeVarNumber(s.version),
                BufferWriter.writeVarNumber(contentsBuf.length),
                contentsBuf
            ]);
        }));
    }

    static fromBuffer(data: Buffer) {
        let reader = new BufferReader(data);
        let lsCount = reader.readVarNumber();
        let shares = new Shares();

        while (shares.shares.length < lsCount) {
            let version = reader.readVarNumber();
            let { offset: contentOffset, size: contentSize } = utils.varStringLength(data.slice(reader.offset));
            reader.seek(contentOffset);
            shares.shares.push({ version, contents: BaseShare.fromBufferReader(version, reader) });
        }

        return shares;
    }
}