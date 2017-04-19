import TaskConstructor from "../pool/TaskConstructor";
import MerkleTree from "../pool/MerkleTree";
import * as assert from 'assert';

describe('TaskConstructor tests', () => {
    let template = `{"capabilities":["proposal"],"version":805306371,"rules":[],"vbavailable":{"testdummy":28,"csv":0,"segwit":1},"vbrequired":0,"previousblockhash":"77d5e44e5fe7c2fddf1bab082545ffe3ebe21fb6e8d004acbde1bcdb82ae4cff","transactions":[],"coinbaseaux":{"flags":""},"coinbasevalue":2500000000,"longpollid":"77d5e44e5fe7c2fddf1bab082545ffe3ebe21fb6e8d004acbde1bcdb82ae4cff15","target":"7fffff0000000000000000000000000000000000000000000000000000000000","mintime":1492518207,"mutable":["time","transactions","prevblock"],"noncerange":"00000000ffffffff","sigoplimit":20000,"sizelimit":1000000,"curtime":1492564149,"bits":"207fffff","height":222,"default_witness_commitment":"6a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf9","auxes":[]}`;
    let p1 = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4b02de0004b5b8f65808fabe6d6d00000000000000000000000000000000000000000000000000000000000000000100000000000000';
    let outputTxs = '020000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf900f90295000000001976a914aec6287421dd340e06a5d01e9dbc1e9d37741dae88ac';
    let p2 = '0d4d696e6564206279205269636500000000020000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf900f90295000000001976a914aec6287421dd340e06a5d01e9dbc1e9d37741dae88ac00000000';
    let job = `["1","82ae4cffbde1bcdbe8d004acebe21fb62545ffe3df1bab085fe7c2fd77d5e44e","01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4b02de0004b5b8f65808fabe6d6d00000000000000000000000000000000000000000000000000000000000000000100000000000000","0d4d696e6564206279205269636500000000020000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf900f90295000000001976a914aec6287421dd340e06a5d01e9dbc1e9d37741dae88ac00000000",[],"30000003","207fffff","58f6b8b5",true]`;

    it('should be a valid job', () => {
        let tc = new TaskConstructor('mwT5FhANpkurDKBVXVyAH1b6T3rz9T1owr');
        let auxTree = MerkleTree.buildMerkleTree([]);

        let task = tc.buildTask(JSON.parse(template), auxTree.root, auxTree.data.length);
        
        assert.equal(task[3], p2);
// 1492564149
    })
});