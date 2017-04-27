

import * as assert from 'assert';
import Addrme from "../p2pool/p2p/Messages/AddrMe";

describe('Test AddrMe', () => {
    it('should be 9333', () => {
        let raw = Buffer.from('7524', 'hex');
        let addrme = Addrme.fromBuffer(raw);
        assert.equal(addrme.port, 9333);
    })
});