

require('../nodejs/AsyncSocket');
import * as kinq from 'kinq';
import { Js2Pool } from "./pool/Js2Pool";
import { Shares } from "./p2p/messages/Shares";
import { DaemonWatcher } from "../core/DaemonWatcher";
import { BaseShare } from "./p2p/shares/index";
import Bitcoin from "./coins/Bitcoin";
import { SharechainHelper } from "./chain/SharechainHelper";
import Sharechain from "./chain/Sharechain";
import { Peer } from "./p2p/Peer";
import * as Bignum from 'bignum';
import { SharechainBuilder } from "./chain/SharechainBuilder";
import { Message } from "./p2p/Message";
import { DefaultWorkerManager } from './pool/DefaultWorkerManager';
kinq.enable();

process.on('uncaughtException', (err) => console.error(err));
process.on('error', (err) => console.error(err));

const opts = {
    daemons: [{
        blocknotifylistener: {
            enabled: true,
            host: 'localhost',
            port: 17777,
        },
        host: 'localhost',
        port: 8332,
        password: 'testpass',
        username: 'testuser',
    }],
    peer: {
        port: 17951,
        maxOutgoing: 3,
    },
    stratum: {
        port: 23456,
    },
    algorithm: 'sha256d',
    bootstrapPeers: [
        {
            host: '123.163.48.115',
            port: 9777,
        },
        {
            host: '123.163.48.115',
            port: 9333
        },
        //{
        //     host: ' 83.217.203.130',
        //     port: 9333
        // }
    ],
    coin: {
        name: 'bitcoin',
        algo: 'sha256',
    },
    address: '1Q9tQR94oD5BhMYAPWpDKDab8WKSqTbxP9',
};

async function run() {
    BaseShare.IDENTIFIER = Bitcoin.IDENTIFIER;
    BaseShare.POWFUNC = Bitcoin.POWFUNC;
    BaseShare.MAX_TARGET = Bitcoin.MAX_TARGET;
    Message.MAGIC = Bitcoin.MSGPREFIX;

    SharechainBuilder.MAX_TARGET = Bitcoin.MAX_TARGET;
    SharechainBuilder.MIN_TARGET = Bitcoin.MIN_TARGET;
    SharechainBuilder.TARGET_LOOKBEHIND = Bitcoin.TARGET_LOOKBEHIND;
    SharechainBuilder.PERIOD = Bitcoin.SHARE_PERIOD;

    SharechainHelper.init('bitcoin');
    let shares = await SharechainHelper.loadSharesAsync();
    console.log('init sharechain', shares.length);
    Sharechain.Instance.add(shares);
    console.log('fix it');
    Sharechain.Instance.fix();
    console.log('share chain length', shares.length);
    setTimeout(() => new Js2Pool(opts, DefaultWorkerManager.Instance), 2000);

    // let daemon = new DaemonWatcher(opts.daemon);
    // daemon.getBlockAsync('000000000000000000020fe5e98fd311039ba3b0953fe6268b5a3a357de83067').then(value => {
    //     console.log(value);
    // });
}

run();
// let shares = '0110fd2507fe02000020d783a0f69ab2e1c88dfa72718c1ee7e3cc6b872fbe7d77010000000000000000d24c08593e1b02183e96a783a13ff41cdbd9a02bccd8c0efbe8f954c81fc422d8c8a220a4c0000000000000004035c1607d664f4f8bb377eb744c21c7c73cd406e14e33af3dd2cb3e3a63eeb4b00000000000000111c27a11e6ea8df0ffe6b1952a40d1508da05a0b5a9424378fef9ce754966ecaf67e71ba72eddf266b8088a64ee02b651259ce2fb9b95f49104d243e0a560c5a89202a4aaa7293ea1f0db9d57aafae01edc5f246104bc93b9c4f4fa42c052b8b4978a2a5bfd519b7182f70683edcdae560a1d7ae14c7ecf855772a7fe822b75b09db893917b6912d3b7103dffa487a504a6d83853bec481cc4532a1a6d32e4659ecb0506a01ff1e567c827ba9b1ed4185521eba3b7f0a4b9c8e537fa4f76a418b363cdf1409a32c002c9e7390ea9e7426b96fe24c57f63843c69e2acfcd9d14c7b1c267067f8c1b5d90964dfb664dfb37ab9a0dc3ef933aefae988b4c4853012498f4ec1e7e22c44c34037d80ebf37a4b9332f091fa8bc69a62dda165200767b7be1863cb64036f8972cdaf61257c3ce99f7915862a866a7f7101f77c8e5a8213509e394fcc4567837667934ecfe31e8bbab9caf005f601e8e7dc2e483e2e8c175d0c9895f6f1efc0a2825930e29b5baec5d121f6d3d5f523df715760e531d0a0145d88eb0555ff9f5763f8227f5bee5867e2a4ef7b858bd1b439db300feba2f4943797597a344020667c6f79d6ea66a475762a121ae1614b347d81b478f9067a620a5134039358463f164559439aa1c2132af0116a1ae068c52aa29ccbc74704bd6b5f3a2b63eefda80598120b13b7ab09c06ea472ae3f477c7e23c922132abd8669c9382ceb799435a9195448c43b15c14737a32f7961767c51c5bf0f5398fa1a30d128a5b5cec9599c2dca4a58d21481db7bcad41e8c8f25ca782906ae962270e0c9d35501acbcb7c2a21a97d86eb31ed9c4d0c3e1aa24e0d54ebb4af328561cbcdf5465951a323092bb2e27fbb9a05b3f9500c56fc0f3b6a4e365e6757b5b276b9a4ebdfd59bb0aa8f728b62f939df6d6f6a162125d60f95cbeeac9410f7982b79bf17abf694cac8daf92193b4defd00ac24e31aa35db6d3389d6135b5ee8080f9f916a66e59b680cf1b11106783a3cef9e894ddafb090469a1eddea142420536a33a115806ed3aa874006c74a1b9cf60e6f42b8530179e56c157e25fb1be86d5e09f7afafbbed418ed7631e1d5a62eeba1da46dc0ec9023ea063f4605d7a41c12d076696d0ccfdd4c112250f3acababb481ae4425cc55d0744c5a41cff65c67d82cbe315d1908a209799a653da3b8b96daf50c631065eb4bca1fe6c272d729578fc309981d788ec7f741eb54db93d2789f1c81f1ef829bb23794c52eb8ef81de01000407050005010101020000000408030003010102040901030502010401050700070107020106040a010705030001010806000601040b0002030201090504010a0505040d010b03030003040c05060201010c050703050202000405080304010d010e060202030410041100052a1b010f070307040306040e040f0204041203070308050902050603030901100413011100060112011300070705050a050b050c07060707041402060114011502070116020800080009030a050d070807090117030b070a050e070b0118070c050f070d000a051005110119020905120415011a070e011b011c070f0513011d05140515020a020b030c011e071005160517011f020c0518012004160519030d051a01210122020d06040711000b020e06050712012301240125020f051b000c01260713051c01270128051d051e051f071401290715012a000d012b0210041804170211030e0716071705200521012c0718000e000f00100011001200130014012d012e012f030f01300522001501310400052300160017052400180019013201330310021202130214071905250526052704190528001a071a041a013405290135041c001b071b052a041b071c384d26ee61c55f47ce42c392563abb9818f92bb020ab15a355000000000000006f3b011a87b2001ad44c085981bd3c00563fe6f887c00d6ebf2200000000000000010000007d789b00d0421de94a027a288cb45ad8b0155476ed8d92d19e44920e6e7a865fcfcb8810fd1014083afad15f4c25d210e204139668a9c1f539bcf736bdc3b7d74e14b5fa4172db9a26e2950af3b2bc1603deb9fa417a4769ba6a2d55fe891c00c9f596ddfbff6a9c16de6b6d1035b48d3ac1ca301e74c097362d1f11f399f0a78d7fddd1b8a90625c5bed1fed19fc22366df29a8b79f5b916a3aaccc9d38464088798e6be94281a73dfc88557dcaf3ee221d6966d1204ce0fe4c574b5be80d0bda0ba6585e8d7c465b1c72a79b2a476b947fe8c8c2dc126af9ec24057b21782d50c7be2e79e2c25723f67c5fed75eca459143d659ea1991a8ca40a46a618055080c5f11eac9827d8c6b7cbe62ee09af65b426d3f08d321ec98ea45776ef75e57965fc026f01d299d';
// let obj = Shares.fromBuffer(Buffer.from(shares, 'hex'));
// console.log(obj);

