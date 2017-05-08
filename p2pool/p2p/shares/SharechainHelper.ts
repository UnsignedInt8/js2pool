
import { BaseShare } from "./index";
import * as path from 'path';
import * as fs from 'fs';
import { Shares } from "../Messages/Shares";
import logger from '../../../misc/Logger';
import { ShareVersionMapper } from "./BaseShare";
import * as BigNum from 'bignum';
import SmallBlockHeader from "./Smallblockheader";
import ShareInfo from "./Shareinfo";
import { HashLink } from "./HashLink";
import * as crypto from 'crypto';

/**
 * Data files name convention
 * shares_startheight_endheight
 */
export class SharechainHelper {

    private static appDir: string;
    private static dataDir: string;

    static get today() {
        return Date.now() / 1000 / 60 / 60 / 24 | 0;
    }

    static init(coin: string) {
        let home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
        let appDir = path.resolve(home, '.js2pool');
        let dataDir = path.resolve(appDir, 'data', coin);
        SharechainHelper.appDir = appDir;
        SharechainHelper.dataDir = dataDir;

        if (!fs.existsSync(appDir)) {
            fs.mkdirSync(appDir);
            fs.mkdirSync(path.resolve(appDir, 'data'));
        }

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }
    }

    static saveShares(shares: BaseShare[]) {
        if (!SharechainHelper.appDir) throw Error('not initialized');
        if (shares.length === 0) return;

        shares = shares.sort((a, b) => a.info.absheight - b.info.absheight);
        let basename = `shares_${SharechainHelper.today}`;
        let filename = path.resolve(SharechainHelper.dataDir, basename);
        
        let seralizableObjs = shares.map(share => {
            let obj = <BaseShare>Object.assign({}, share);
            obj.SUCCESSOR = null;
            obj.refMerkleLink = <any>obj.refMerkleLink.map(l => l.toString('hex'));
            obj.merkleLink = <any>obj.merkleLink.map(l => l.toString('hex'));
            obj.newScript = <any>obj.newScript.toString('hex');
            obj.gentxHash = <any>obj.gentxHash.toString('hex');
            obj.lastTxoutNonce = <any>obj.lastTxoutNonce.toBuffer().toString('hex');
            obj.info.data.subsidy = <any>obj.info.data.subsidy.toBuffer().toString('hex');

            if (obj.info.segwit) {
                obj.info.segwit.txidMerkleLink.branch = <any>obj.info.segwit.txidMerkleLink.branch.map(b => b.toString('hex'));
                obj.info.segwit.wtxidMerkleRoot = <any>obj.info.segwit.wtxidMerkleRoot.toString('hex');
            }

            obj.hashLink.state = <any>obj.hashLink.state.toString('hex');
            obj.hashLink.extra = <any>obj.hashLink.extra.toString('hex');

            return obj;
        });

        let data = JSON.stringify(seralizableObjs);

        fs.writeFile(filename, data, 'utf8', err => {
            if (!err) return;
            logger.error(err.message);
        });
    }

    static async loadSharesAsync(fromAbsheight: number = 0, toAbsheight: number = 0) {
        if (!SharechainHelper.appDir) throw Error('not initialized');

        let files = await new Promise<string[]>(resolve => {
            let files = fs.readdirSync(SharechainHelper.dataDir);
            resolve(files);
        });

        let targetFiles = files.select(item => {
            let items = item.split('.')[0].split('_');
            return { filename: path.resolve(SharechainHelper.dataDir, item), begin: Number.parseInt(items[1]), end: Number.parseInt(items[2]) };
        }).skipWhile(file => file.begin < fromAbsheight).takeWhile(file => file.end <= toAbsheight).select(file => file.filename).toArray();

        let shares = await new Promise<BaseShare[]>(resolve => {
            let shares = targetFiles.select(filename => {
                let file = fs.readFileSync(filename, 'utf8');
                if (!file.length) return [];

                let objs = JSON.parse(file) as BaseShare[];
                return objs.map(obj => {
                    let header = SmallBlockHeader.fromObject(obj.minHeader);

                    if (obj.info.segwit) {
                        obj.info.segwit.wtxidMerkleRoot = Buffer.from(<any>obj.info.segwit.wtxidMerkleRoot, 'hex');
                        obj.info.segwit.txidMerkleLink.branch = obj.info.segwit.txidMerkleLink.branch.map(b => Buffer.from(<any>b, 'hex'));
                    }

                    obj.hashLink.state = Buffer.from(<any>obj.hashLink.state, 'hex');
                    obj.hashLink.extra = Buffer.from(<any>obj.hashLink.extra, 'hex');

                    obj.info.data.subsidy = BigNum.fromBuffer(Buffer.from(<any>obj.info.data.subsidy, 'hex'), { endian: 'little', size: 8 });
                    let info = ShareInfo.fromObject(obj.info);
                    let hashlink = HashLink.fromObject(obj.hashLink);

                    let share = ShareVersionMapper[obj.VERSION](header, info, hashlink) as BaseShare;
                    share.refMerkleLink = obj.refMerkleLink.map(l => Buffer.from(<any>l, 'hex'));
                    share.merkleLink = obj.merkleLink.map(l => Buffer.from(<any>l, 'hex'));
                    share.newScript = Buffer.from(<any>obj.newScript, 'hex');
                    share.gentxHash = Buffer.from(<any>obj.gentxHash, 'hex');
                    share.lastTxoutNonce = BigNum.fromBuffer(Buffer.from(<any>obj.lastTxoutNonce, 'hex'), { endian: 'little', size: 8 });
                    share.target = obj.target;
                    share.validity = obj.validity;

                    return share;
                });
            }).flatten(false).toArray();
            resolve(shares);
        });

        return shares;
    }
}