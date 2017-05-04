import * as kinq from 'kinq';
import SHA256 from "../core/SHA256";
import * as crypto from 'crypto';
import * as assert from 'assert';

kinq.enable();

describe('SHA256', () => {
    it('should be equal 1', () => {
        for (let i = 0; i < Math.abs(Math.random() * 1000); i++) {
            let msg = crypto.randomBytes(Math.abs(Math.random()) * 1000 | 0);
            assert.equal(new SHA256(msg).digestHex(), crypto.createHash('sha256').update(msg).digest().toString('hex'));
        }
    });

    it('should be equal 2', () => {
        for (let i = 0; i < Math.abs(Math.random() * 1000); i++) {
            let msg = crypto.randomBytes(Math.abs(Math.random()) * 1000 | 0);
            let sha256js = new SHA256();
            sha256js.update(msg);
            assert.equal(sha256js.digestHex(), crypto.createHash('sha256').update(msg).digest().toString('hex'));
        }
    });
});