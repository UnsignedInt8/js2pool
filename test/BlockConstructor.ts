
import TaskConstructor from "../pool/TaskConstructor";
import MerkleTree from "../pool/MerkleTree";
import * as assert from 'assert';
import SharesManager from "../pool/SharesManager";

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
let auxTree = MerkleTree.buildMerkleTree([]);
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