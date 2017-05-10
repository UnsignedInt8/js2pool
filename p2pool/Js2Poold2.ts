require('../nodejs/AsyncSocket');

import { Peer } from "./p2p/Peer";
import * as Bignum from 'bignum';
import Sharechain from "./p2p/shares/Sharechain";
import { SharechainHelper } from "./p2p/shares/SharechainHelper";

import * as kinq from 'kinq';
import { BaseShare } from "./p2p/shares/BaseShare";
import Bitcoin from "./coins/Bitcoin";
import { Js2Pool } from "./pool/Js2Pool";
kinq.enable();

SharechainHelper.init('bitcoin2');
BaseShare.IDENTIFIER = Bitcoin.IDENTIFIER;
SharechainHelper.init('bitcoin');
let shares = SharechainHelper.loadShares();
Sharechain.Instance.add(shares);
console.log(shares.length);

const opts = {
    daemon: {
        blocknotifylistener: {
            enabled: false,
            host: 'localhost',
            port: 17778,
        },
        host: 'localhost',
        port: 8332,
        password: 'testpass',
        username: 'testuser',
    },
    server: {
        port: 19990,
    },
    bootstrapPeers: [{
        host: 'localhost',
        port: 9777
    }],
    coin: {
        name: 'bitcoin',
        algo: 'sha256',
    }
};

setTimeout(async () => {
    setTimeout(() => {
        let pool = new Js2Pool(opts);

        setInterval(() => {
            let node = pool.peer.peers.first()[1];
            node.sendPingAsync();
            node.sendSharereqAsync({ id: new Bignum(8964), parents: 2, hashes: ['00000000000003104e3b54d5c817acd91a2cc121dc23e81b3353bbcfaa1776ff'] });
        }, 5000);
    }, 2000);

}, 20);
