

import * as assert from 'assert';
import { Version } from "../p2pool/p2p/Messages/Version";

describe('Test Pool Protocol Messages', () => {
    it('can be deserialized', () => {
        let rawBuf = Buffer.from('400600000000000000000000000000000000000000000000000000000000ffffdf56b9ecedcd000000000000000000000000000000000000ffff9fcb67b224754c04a8cc44ff07831031352e302d32302d6732653565323534010000002fb1aa6323dfed609231201e9a9c84a3e0781dc8f700eb8f3e01000000000000', 'hex');
        let ver = Version.fromBuffer(rawBuf);
        assert.equal(ver.version, 1600);
        assert.deepEqual(ver.networkServices, Buffer.alloc(8, 0));
        assert.equal(ver.mode, 1);
        assert.equal(ver.addressTo.ip, '223.86.185.236');
        assert.equal(ver.addressTo.port, 60877);
        assert.equal(ver.addressFrom.ip, '159.203.103.178');
        assert.equal(ver.addressFrom.port, 9333);
        assert.equal(ver.nonce, 9441795814761957000);
        assert.equal(ver.subVersion, '15.0-20-g2e5e254');
        assert.equal(ver.mode, 1);
        assert.equal(ver.bestShareHash, '000000000000013e8feb00f7c81d78e0a3849c9a1e20319260eddf2363aab12f');
    });
});