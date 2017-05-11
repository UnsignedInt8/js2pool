import * as Algos from '../core/Algos';
import * as Bignum from 'bignum';
import * as assert from 'assert';
import * as kinq from 'kinq';
kinq.enable();

describe('Algos', () => {
    it('bitsToTarget', () => {
        let bits = Bignum.fromBuffer(Buffer.from('1801f6a7', 'hex')).toNumber();
        let targetbignum = Algos.bitsToTarget(bits);
        let targetnumber = (bits & 0x00ffffff) * Math.pow(2, 8 * ((bits >> 24) - 3));
        assert.equal(targetbignum.toNumber(), targetnumber);

        assert.equal(Algos.targetToBits(targetbignum), 0x1801f6a7);
    });

    it('targetToBits', () => {
        let target = Algos.bitsToTarget(0x20010000);
        assert.equal(Algos.targetToBits(target), 0x20010000);
    });
});