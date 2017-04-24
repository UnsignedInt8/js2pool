
import * as assert from 'assert';
import * as kinq from 'kinq';
import MerkleTree from "../core/MerkleTree";
import SharesManager from "../core/SharesManager";
import { TaskConstructor } from "../core/TaskConstructor";
kinq.enable();

let auxTree = MerkleTree.buildMerkleTree([]);

describe('Block Constructor Test', () => {

    it('has no txs', () => {

        const rpc = `{"capabilities":["proposal"],"version":805306371,"rules":[],"vbavailable":{"testdummy":28,"csv":0,"segwit":1},"vbrequired":0,"previousblockhash":"0000000ef2436e28efb7bb774ff4fbd3d569933659e5eb855f21afe041060412","transactions":[],"coinbaseaux":{"flags":""},"coinbasevalue":2500000000,"longpollid":"0000000ef2436e28efb7bb774ff4fbd3d569933659e5eb855f21afe04106041225","target":"7fffff0000000000000000000000000000000000000000000000000000000000","mintime":1492585578,"mutable":["time","transactions","prevblock"],"noncerange":"00000000ffffffff","sigoplimit":20000,"sizelimit":1000000,"curtime":1492667990,"bits":"207fffff","height":232,"default_witness_commitment":"6a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf9","auxes":[]}`;
        const extranonce1 = `60000000`;
        const extranonce2 = `00000000`;
        const nTime = `58f84e56`;
        const nonce = '8746c71e';
        const cbTx1 = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4b02e80004f74df85808fabe6d6d00000000000000000000000000000000000000000000000000000000000000000100000000000000';
        const cbTx2 = '0d4d696e6564206279205269636500000000020000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf900f90295000000001976a914aec6287421dd340e06a5d01e9dbc1e9d37741dae88ac00000000';
        const cbHash = '7daa6be3a160752d19dde44d166538ba342790e4c1dffdc4022e60c38a40cf72';
        const merkleRoot = '72cf408ac3602e02c4fddfc1e4902734ba3865164de4dd192d7560a1e36baa7d';
        const headerHash = '7ac027a75217ecb467a78c8e7d09e70c9783d85e6536276bf79f8ff90f000000';
        const blockHash = '0000000ff98f9ff76b2736655ed883970ce7097d8e8ca767b4ec1752a727c07a';
        const blockHex = '0300003012040641e0af215f85ebe559369369d5d3fbf44f77bbb7ef286e43f20e0000007daa6be3a160752d19dde44d166538ba342790e4c1dffdc4022e60c38a40cf72564ef858ffff7f201ec746870101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4b02e80004f74df85808fabe6d6d0000000000000000000000000000000000000000000000000000000000000000010000000000000060000000000000000d4d696e6564206279205269636500000000020000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf900f90295000000001976a914aec6287421dd340e06a5d01e9dbc1e9d37741dae88ac00000000';

        let tx1Time = 1492667895;
        let template = JSON.parse(rpc);

        let tc = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');
        tc.debugTxTime = tx1Time;
        let task = tc.buildTask(template, auxTree.root, auxTree.data.length);

        assert.equal(task.previousBlockHash, template.previousblockhash);
        assert.equal(task.coinbaseTx.part1.toString('hex'), cbTx1);
        assert.equal(task.coinbaseTx.part2.toString('hex'), cbTx2);

        let sm = new SharesManager('sha256d');
        sm.updateTemplate(template);
        let share = sm.buildShare(task, nonce, extranonce1, extranonce2, nTime);

        assert.equal(share.merkleRoot, merkleRoot);
        assert.equal(share.shareHex, blockHex);
        assert.equal(share.shareHash, blockHash);

    });

    it('has txs', () => {

        let txRpc = `{"capabilities":["proposal"],"version":805306371,"rules":[],"vbavailable":{"testdummy":28,"csv":0,"segwit":1},"vbrequired":0,"previousblockhash":"0000000b0f97e9e797d0d40f6f899b82bee1f4390025fbe8f24ac5a493e831c6","transactions":[{"data":"0200000001db632cee44a2a4fe1cbb44ec583a569a989080f6acf79d949f1fdabbc7314408000000006b483045022100e93e2b7fcd355adcd33d875f1a9905608e0dfc02b7969351399e59af653f329902203fc50adb190cb7d2c16e3015c606f3b2c777a66e75810e0480970423eab1cd3e0121020967df9f6149d685e7a7f58045c2716abc344e89b58a1e784ce20b6add6a539bfeffffff0200943577000000001976a914eafa16319572221228ace8dd875f8f935d3e426788acb0979a3b000000001976a914443df0b06b4920114cf8d742740b825ff956a40a88acef000000","txid":"37da9732a7cc1fb38a2240475d5fb86f1ad8085a68e9d5b31530f091fe09a53d","hash":"37da9732a7cc1fb38a2240475d5fb86f1ad8085a68e9d5b31530f091fe09a53d","depends":[],"fee":4520,"sigops":2,"weight":904},{"data":"0200000001412bd7016937978a2f894d1699699572c86688c683a01f8cf33560357c23e972010000006b4830450221009913803ddcb3364409ffcdf62656f7eb6b4b6d6944cc004e27fe8f732341d49b022061710c12640045d864ce42cebdb4155ff923f5b4114824eb8233b089b6ac3c330121032aa8a0025cbb0625716de1dabbd382b74ae2654eb2c576cf8573c23f387badaafeffffff0258a99a3b000000001976a91498ec318bb879f151914b2a18fffeb0a16bb8753988ac00943577000000001976a914eafa16319572221228ace8dd875f8f935d3e426788acef000000","txid":"df49fff7cba5713af0e98af9181cb2ed6d8b5ffd3ff96b5439bcb6a735da2848","hash":"df49fff7cba5713af0e98af9181cb2ed6d8b5ffd3ff96b5439bcb6a735da2848","depends":[],"fee":4520,"sigops":2,"weight":904}],"coinbaseaux":{"flags":""},"coinbasevalue":2500009040,"longpollid":"0000000b0f97e9e797d0d40f6f899b82bee1f4390025fbe8f24ac5a493e831c639","target":"7fffff0000000000000000000000000000000000000000000000000000000000","mintime":1492671827,"mutable":["time","transactions","prevblock"],"noncerange":"00000000ffffffff","sigoplimit":20000,"sizelimit":1000000,"curtime":1492674404,"bits":"207fffff","height":240,"default_witness_commitment":"6a24aa21a9ed799c4b087b199ca324eebff3b1e3e9b3729cd623c075cdbeb36ca0e0392d485f","auxes":[]}`;
        let extranonce1 = '60000000';
        let extranonce2 = '00000000';
        let nTime = '58f86764';
        let nonce = '22603a05';
        let merkleRoot = 'd21c8ebed647fbb462756a576ea74370f04bcb7bec7556fbbd613cff9693a86b';
        let cbHash = 'e3f47dd237e3f0595ec9b2f04310a9f0d76100c541f76014577c0c452382c1ed';
        let cbTx1 = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4b02f000043a67f85808fabe6d6d00000000000000000000000000000000000000000000000000000000000000000100000000000000';
        let cbTx2 = '0d4d696e6564206279205269636500000000020000000000000000266a24aa21a9ed799c4b087b199ca324eebff3b1e3e9b3729cd623c075cdbeb36ca0e0392d485f501c0395000000001976a914aec6287421dd340e06a5d01e9dbc1e9d37741dae88ac00000000';
        let blockHash = '0000000418717747eb289f76f986d24b2454b1070e171a2724f53a04e2f38d9d';
        let blockHex = '03000030c631e893a4c54af2e8fb250039f4e1be829b896f0fd4d097e7e9970f0b0000006ba89396ff3c61bdfb5675ec7bcb4bf07043a76e576a7562b4fb47d6be8e1cd26467f858ffff7f20053a60220301000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4b02f000043a67f85808fabe6d6d0000000000000000000000000000000000000000000000000000000000000000010000000000000060000000000000000d4d696e6564206279205269636500000000020000000000000000266a24aa21a9ed799c4b087b199ca324eebff3b1e3e9b3729cd623c075cdbeb36ca0e0392d485f501c0395000000001976a914aec6287421dd340e06a5d01e9dbc1e9d37741dae88ac000000000200000001db632cee44a2a4fe1cbb44ec583a569a989080f6acf79d949f1fdabbc7314408000000006b483045022100e93e2b7fcd355adcd33d875f1a9905608e0dfc02b7969351399e59af653f329902203fc50adb190cb7d2c16e3015c606f3b2c777a66e75810e0480970423eab1cd3e0121020967df9f6149d685e7a7f58045c2716abc344e89b58a1e784ce20b6add6a539bfeffffff0200943577000000001976a914eafa16319572221228ace8dd875f8f935d3e426788acb0979a3b000000001976a914443df0b06b4920114cf8d742740b825ff956a40a88acef0000000200000001412bd7016937978a2f894d1699699572c86688c683a01f8cf33560357c23e972010000006b4830450221009913803ddcb3364409ffcdf62656f7eb6b4b6d6944cc004e27fe8f732341d49b022061710c12640045d864ce42cebdb4155ff923f5b4114824eb8233b089b6ac3c330121032aa8a0025cbb0625716de1dabbd382b74ae2654eb2c576cf8573c23f387badaafeffffff0258a99a3b000000001976a91498ec318bb879f151914b2a18fffeb0a16bb8753988ac00943577000000001976a914eafa16319572221228ace8dd875f8f935d3e426788acef000000';
        let cbTxTime = 1492674362;

        let template = JSON.parse(txRpc);

        let tc = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');
        tc.debugTxTime = cbTxTime;
        let task = tc.buildTask(template, auxTree.root, auxTree.data.length);
        assert.equal(task.previousBlockHash, template.previousblockhash);
        assert.equal(task.coinbaseTx.part1.toString('hex'), cbTx1);
        assert.equal(task.coinbaseTx.part2.toString('hex'), cbTx2);
        assert.deepEqual(task.merkleLink.map(l => l.toString('hex')), ['3da509fe91f03015b3d5e9685a08d81a6fb85f5d4740228ab31fcca73297da37', '9fa1076e2a135713fa069d32b8d8f4e9789a1c10b89b43221362309d1d3e24bb']);

        let sm = new SharesManager('sha256d');
        sm.updateTemplate(template);
        let share = sm.buildShare(task, nonce, extranonce1, extranonce2, nTime);


        assert.equal(share.merkleRoot, merkleRoot);
        assert.equal(share.shareHex, blockHex);
        assert.equal(share.shareHash, blockHash);
    });
});
