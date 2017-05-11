import * as mathex from '../misc/MathEx';
import * as assert from 'assert';
import * as Bignum from 'bignum';

describe('MathEx', () => {
    it('clip', () => {
        assert.equal(mathex.clip(5, 1, 10), 5);
        assert.equal(mathex.clip(-1, 0, 10), 0);
        assert.equal(mathex.clip(10.1, 9, 10), 10);
        assert.equal(mathex.clip(new Bignum(2), new Bignum(0), new Bignum(5)).toNumber(), 2);
        assert.equal(mathex.clip(new Bignum(-1), new Bignum(0), new Bignum(2)).toNumber(), 0);
        assert.equal(mathex.clip(new Bignum(11), new Bignum(-Infinity), new Bignum(10)).toNumber(), 10);
    });
});