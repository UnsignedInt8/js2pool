/*
 * Created on Fri Apr 07 2017 UnsignedInt8
 */

export abstract class Payload {
    toBuffer(): Buffer {
        throw new Error('Method not implemented.');
    }

    static fromObject(obj: any): Payload {
        throw new Error('Method not implemented.');
    }

    static fromBuffer(payload: Buffer): Payload | Payload[] {
        throw new Error('Method not implemented.');
    }
}