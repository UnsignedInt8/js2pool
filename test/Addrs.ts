import * as assert from 'assert';
import Addrs from "../p2pool/p2p/Messages/Addrs";

describe('Test Addrs', () => {
    it('should be a address', () => {
        let raw = Buffer.from('01609ce85800000000000000000000000000000000000000000000ffff4f8935042475', 'hex');
        let addrs = Addrs.fromBuffer(raw);
        assert.equal(addrs.length, 1);

        let node = addrs[0];
        assert.equal(node.ip, '79.137.53.4');
        assert.equal(node.port, 9333);
        assert.equal(node.timestamp, 1491639392);

        let data = Addrs.fromObjects([{ ip: '79.137.53.4', port: 9333, timestamp: 1491639392 }]);
        assert.deepEqual(data, raw);
    });
});