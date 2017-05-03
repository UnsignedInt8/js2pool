import SmallBlockHeader from './Smallblockheader';
import ShareInfo from './Shareinfo';
import { HashLink } from './HashLink';
import BufferReader from '../../../misc/BufferReader';
import * as utils from '../../../misc/Utils';
import BufferWriter from '../../../misc/BufferWriter';
import * as assert from 'assert';
import * as fastMerkleRoot from 'merkle-lib/fastRoot';
import * as BigNum from 'bignum';
import { bitsToDifficulty } from "../../../core/Algos";

const DONATION_SCRIPT = Buffer.from('4104ffd03de44a6e11b9917f3a29f9443283d9871c9d743ef30d5eddcd37094b64d1b3d8090496b53256786bf5c82932ec23c3b74d9f05a6f95a8b5529352656664bac', 'hex')
const gentx_before_refhash = Buffer.concat([BufferWriter.writeVarNumber(DONATION_SCRIPT.length), DONATION_SCRIPT, Buffer.alloc(8, 0), BufferWriter.writeVarString('6a28' + '0000000000000000000000000000000000000000000000000000000000000000' + '0000000000000000', 'hex').slice(0, 3)]);
assert.equal(gentx_before_refhash.toString('hex'), '434104ffd03de44a6e11b9917f3a29f9443283d9871c9d743ef30d5eddcd37094b64d1b3d8090496b53256786bf5c82932ec23c3b74d9f05a6f95a8b5529352656664bac00000000000000002a6a28');

export abstract class BaseShare {

    static SEGWIT_ACTIVATION_VERSION = 0 // This should be initalized when pool starts
    static IDENTIFIER: string;

    VERSION = 0;
    VOTING_VERSION = 0;
    SUCCESSOR = null;
    MAX_BLOCK_WEIGHT = 4000000;
    MAX_NEW_TXS_SIZE = 50000;

    minHeader: SmallBlockHeader;
    info: ShareInfo;
    refMerkleLink: Buffer[]; // 256 bits list
    lastTxoutNonce: number; // 64 bits
    hashLink: HashLink;
    merkleLink: string[];

    hash: string;
    newScript: Buffer;
    target: number;
    gentxHash: any;

    constructor(minHeader: SmallBlockHeader = null, info: ShareInfo = null, hashLink: HashLink = null, merkleLink: string[] = null) {
        this.minHeader = minHeader;
        this.info = info;
        this.hashLink = hashLink;
        this.merkleLink = merkleLink;
    }

    init() {
        let n = new Set<number>();
        this.info.extractTransactionHashRefs().forEach(tuple => {
            let { shareCount, txCount } = tuple;
            assert.equal(shareCount < 110, true);
            if (shareCount > 0) return;
            n.add(txCount);
        });
        // console.log(n);
        assert.equal(n.size, this.info.newTransactionHashes.length);

        let diff = bitsToDifficulty(this.info.bits);
        this.newScript = utils.hash160ToScript(this.info.data.pubkeyHash); // script Pub Key
        this.target = this.info.toTarget();
        let refHash = BaseShare.getRefHash(this.info, this.refMerkleLink);
        this.gentxHash = this.checkHashLink(
            this.hashLink,
            Buffer.concat([BaseShare.getRefHash(this.info, this.refMerkleLink), new BigNum(this.lastTxoutNonce).toBuffer({ endian: 'little', size: 8 }), Buffer.alloc(4, 0)]),
            gentx_before_refhash
        )
    }

    private checkHashLink(hashLink: HashLink, data: Buffer, constEnding: Buffer) {
        let extraLength = hashLink.length % (512 / 8);
        let extra = constEnding.slice(constEnding.length - extraLength);
        // assert.equal(extra.length, extraLength);

    }

    toBuffer(): Buffer {
        return Buffer.concat([
            this.minHeader.toBuffer(),
            this.info.toBuffer(),
            BufferWriter.writeList(this.refMerkleLink),
            BufferWriter.writeNumber(this.lastTxoutNonce, 8),
            this.hashLink.toBuffer(),
            BufferWriter.writeList(this.merkleLink.map(h => utils.uint256BufferFromHash(h)))
        ]);
    }

    static fromBufferReader(version: number, reader: BufferReader) {
        let share = version === 16 ? new Share() : new NewShare();
        share.minHeader = SmallBlockHeader.fromBufferReader(reader);
        share.info = ShareInfo.fromBufferReader(reader, BaseShare.isSegwitActivated(share.VERSION, BaseShare.SEGWIT_ACTIVATION_VERSION));
        share.refMerkleLink = reader.readList(32);
        share.lastTxoutNonce = reader.readNumber(8);
        share.hashLink = HashLink.fromBufferReader(reader);
        share.merkleLink = reader.readList(32).map(utils.hexFromReversedBuffer);
        share.init();
        return share;
    }

    static isSegwitActivated(version: number, segwit_activation_version: number) {
        return version >= segwit_activation_version && segwit_activation_version > 0
    }

    static getRefHash(shareInfo: ShareInfo, refMerkleLink: Buffer[]) {
        let ref = new Ref();
        ref.identifier = BaseShare.IDENTIFIER;
        ref.info = shareInfo;
        let hashes = [utils.sha256d(ref.toBuffer())].concat(refMerkleLink);
        return utils.uint256BufferFromHash(fastMerkleRoot(hashes, utils.sha256d));
    }
}

export class Share extends BaseShare {
    static readonly VERSION = 16;
    static readonly VOTING_VERSION = 16;
    readonly SUCCESSOR = NewShare;

    constructor() {
        super();
        super.VERSION = Share.VERSION;
        super.VOTING_VERSION = Share.VOTING_VERSION;
    }
}

export class NewShare extends BaseShare {
    static readonly VERSION = 17;
    readonly VOTING_VERSION = 17;
    readonly MAX_NEW_TXS_SIZE = 100000;

    constructor() {
        super();
        super.VERSION = NewShare.VERSION;
    }
}

class Ref {
    identifier: string; // 8 characters FixedStrType
    info: ShareInfo;

    toBuffer() {
        return Buffer.concat([
            BufferWriter.writeFixedString(this.identifier),
            this.info.toBuffer(),
        ]);
    }
}