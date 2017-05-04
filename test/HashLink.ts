import * as crypto from 'crypto';
import * as kinq from 'kinq';
import { HashLink } from "../p2pool/p2p/shares/HashLink";
import * as assert from 'assert';
import * as Utils from '../misc/Utils';

kinq.enable();

describe('HashLink', () => {
    it('hash link 1', () => {
        for (let i = 0; i < (Math.random() * 100 | 0); i++) {
            let d = crypto.randomBytes(2048);
            assert.deepEqual(HashLink.fromPrefix(d).check(Buffer.alloc(0)), Utils.sha256d(d));
        }
    });

    it('hash link 2', () => {
        for (let i = 0; i < 10; i++) {
            let d1 = crypto.randomBytes(2048);
            let d2 = crypto.randomBytes(2048);
            assert.deepEqual(HashLink.fromPrefix(d1).check(d2), Utils.sha256d(Buffer.concat([d1, d2])));
        }
    });

    it('hash link 3', () => {
        for (let i = 0; i < 10; i++) {
            let d1 = crypto.randomBytes(2048);
            let d2 = crypto.randomBytes(2048);
            let d3 = crypto.randomBytes(2048);

            assert.deepEqual(HashLink.fromPrefix(Buffer.concat([d1, d2]), d2).check(d3, d2), Utils.sha256d(Buffer.concat([d1, d2, d3])))
        }
    });
});