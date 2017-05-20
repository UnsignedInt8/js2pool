require('../nodejs/AsyncSocket');

import { Peer } from "./p2p/Peer";
import * as Bignum from 'bignum';
import Sharechain from "./chain/Sharechain";
import { SharechainHelper } from "./chain/SharechainHelper";

import * as kinq from 'kinq';
import { BaseShare } from "./p2p/shares/BaseShare";
import Bitcoin from "./coins/Bitcoin";
import { Js2Pool } from "./pool/Js2Pool";
import { DefaultWorkerManager } from './pool/DefaultWorkerManager';
import { App } from "./App";
kinq.enable();

SharechainHelper.init('bitcoin2');
BaseShare.IDENTIFIER = Bitcoin.IDENTIFIER;
SharechainHelper.init('bitcoin');
SharechainHelper.loadSharesAsync().then(shares => {
    Sharechain.Instance.add(shares);
    console.log(shares.length);
});

const opts = {
    address: '1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9',
    daemons: [{
        blocknotifylistener: {
            enabled: false,
            host: 'localhost',
            port: 17778,
        },
        host: 'localhost',
        port: 8332,
        password: 'testpass',
        username: 'testuser',
    }],
    peer: {
        port: 19990,
        maxOutgoing: 3,
    },
    stratum: {
        port: 23456
    },
    bootstrapPeers: [{
        host: '123.163.48.115',
        port: 9777
    }, {
        host: '123.163.48.115',
        port: 9333
    }],
    coin: {
        name: 'bitcoin',
        algorithm: 'sha256d',
    }
};

App(opts);