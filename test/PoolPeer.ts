require('../nodejs/AsyncSocket');
import * as assert from 'assert';
import Node from "../p2pool/p2p/Node";

describe('Test PoolPeer', () => {
    it('should get the version message', async () => {
        let peer = new Node('123.163.48.115', 9333);

        let returnPromise = new Promise((resolve, reject) => {
            peer.onVersionVerified((sender, version) => {
                assert.equal(sender, peer);
                assert.equal(version.subVersion.startsWith('15.0'), true);
                resolve();
            });
        });

        if (!await peer.connectAsync()) {
            throw new Error('cannot connect');
        }

        await peer.sendVersionAsync();
        await peer.sendPingAsync();
        return returnPromise;
    });
});