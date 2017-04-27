require('../nodejs/AsyncSocket');
import * as net from 'net';
import * as assert from 'assert';

before(() => {
    let server = net.createServer(async s => {
        let data = await s.readAsync();
        await s.writeAsync(data);
    }).listen(37980);
});

describe('Async Socket Testcases', () => {
    it('should write data synchronous', async () => {
        let client = new net.Socket();
        let text = 'hello world ' + Math.random();
        await client.connectAsync(37980, 'localhost');
        await client.writeAsync(text);
        let msg = await client.readAsync();
        assert.equal(msg.toString(), text);
    });
});
