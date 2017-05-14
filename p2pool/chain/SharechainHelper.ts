
import { BaseShare } from "../p2p/shares";
import { ShareVersionMapper } from "../p2p/shares/BaseShare";
import * as path from 'path';
import * as fs from 'fs';
import { Shares } from "../p2p/messages/Shares";
import logger from '../../misc/Logger';
import * as Bignum from 'bignum';
import SmallBlockHeader from "../p2p/shares/SmallBlockHeader";
import ShareInfo from "../p2p/shares/ShareInfo";
import { HashLink } from "../p2p/shares/HashLink";
import * as crypto from 'crypto';
import * as readline from 'readline';
import { CompleterResult } from "readline";
import Sharechain from "./Sharechain";

/**
 * Data files name convention
 * shares_startheight_endheight
 */
export class SharechainHelper {

    static appDir: string;
    static dataDir: string;

    static get today() {
        return Date.now() / 1000 / 60 / 60 / 24 | 0;
    }

    static init(coin: string) {
        let home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
        let appDir = path.resolve(home, '.js2pool');
        let dataDir = path.resolve(appDir, 'data', coin);
        SharechainHelper.appDir = appDir;
        SharechainHelper.dataDir = dataDir;

        if (!fs.existsSync(appDir)) fs.mkdirSync(appDir);
        if (!fs.existsSync(path.resolve(appDir, 'data'))) fs.mkdirSync(path.resolve(appDir, 'data'));
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

        let deprecatedFiles = fs.readdirSync(dataDir).where(name => Number.parseInt(name.split('_')[1]) < SharechainHelper.today - 2).select(name => path.resolve(dataDir, name)).toArray();
        deprecatedFiles.each(path => fs.unlinkSync(path));
    }

    static saveShares(shares: _Linqable<BaseShare>) {
        if (!SharechainHelper.appDir) throw Error('not initialized');

        let basename = `shares_${SharechainHelper.today}`;
        let filename = path.resolve(SharechainHelper.dataDir, basename);

        let seralizableObjs = shares.where(s => s.validity).select(share => {
            try {
                let obj = <BaseShare>Object.assign({}, share);
                obj.info = Object.assign({}, share.info);
                obj.info.data = Object.assign({}, share.info.data);

                obj.minHeader = Object.assign({}, share.minHeader);
                obj.hashLink = Object.assign({}, share.hashLink);
                obj.SUCCESSOR = null;
                obj.refMerkleLink = <any>share.refMerkleLink.map(l => l.toString('hex'));
                obj.merkleLink = <any>share.merkleLink.map(l => l.toString('hex'));
                // obj.newScript = <any>share.newScript.toString('hex');
                obj.gentxHash = <any>share.gentxHash.toString('hex');
                obj.lastTxoutNonce = <any>share.lastTxoutNonce.toBuffer().toString('hex');
                obj.target = <any>share.target.toBuffer().toString('hex');
                obj.maxTarget = <any>share.maxTarget.toBuffer().toString('hex');
                obj.work = <any>share.work.toBuffer().toString('hex');
                obj.minWork = <any>share.minWork.toBuffer().toString('hex');
                obj.info.data.subsidy = <any>share.info.data.subsidy.toBuffer().toString('hex');

                delete obj.weight;
                delete obj.totalWeight;
                delete obj.donationWeight;

                if (obj.info.segwit) {
                    obj.info.segwit = Object.assign({}, share.info.segwit);
                    obj.info.segwit.txidMerkleLink.branch = <any>share.info.segwit.txidMerkleLink.branch.map(b => b.toString('hex'));
                    obj.info.segwit.wtxidMerkleRoot = <any>share.info.segwit.wtxidMerkleRoot.toString('hex');
                }

                obj.hashLink.state = <any>share.hashLink.state.toString('hex');
                obj.hashLink.extra = <any>share.hashLink.extra.toString('hex');

                return JSON.stringify(obj);
            } catch (err) {
                logger.error(err.message);
                logger.error(share);
                return '';
            }
        }).toArray();

        let file = fs.createWriteStream(filename, <any>{ flags: 'a' });
        file.on('error', err => { logger.error(err.message); file.end(); });
        file.on('end', () => file.removeAllListeners());
        seralizableObjs.forEach(obj => file.write(obj + '\n'));
        file.end();
    }

    static async loadSharesAsync(days: number = 3) {
        if (!SharechainHelper.appDir) throw Error('not initialized');

        let files = fs.readdirSync(SharechainHelper.dataDir);
        let targetFiles = files.where(s => s.startsWith('shares_')).select(item => {
            let items = item.split('.')[0].split('_');
            return { path: path.resolve(SharechainHelper.dataDir, item), day: Number.parseInt(items[1]) };
        }).orderByDescending(i => i.day).take(days).toArray();

        let allShares = new Array<BaseShare>();

        for (let file of targetFiles) {
            let onePart = await new Promise<Array<BaseShare>>(resolve => {
                let shares = new Array<BaseShare>();
                let filestream = fs.createReadStream(file.path, { autoClose: true, encoding: 'utf8' });
                let size = fs.statSync(file.path).size;

                let reader = readline.createInterface({
                    input: filestream,
                    terminal: false
                });

                reader.on('error', (error) => {
                    logger.error(error.message);
                    reader.close();
                    resolve([]);
                });

                reader.on('close', () => {
                    reader.removeAllListeners();
                    resolve(shares);
                });

                reader.on('line', data => {
                    if (!data) return;

                    let obj = JSON.parse(data);
                    let header = SmallBlockHeader.fromObject(obj.minHeader);
                    if (obj.info.segwit) {
                        obj.info.segwit.wtxidMerkleRoot = Buffer.from(<any>obj.info.segwit.wtxidMerkleRoot, 'hex');
                        obj.info.segwit.txidMerkleLink.branch = obj.info.segwit.txidMerkleLink.branch.map(b => Buffer.from(<any>b, 'hex'));
                    }

                    obj.hashLink.state = Buffer.from(<any>obj.hashLink.state, 'hex');
                    obj.hashLink.extra = Buffer.from(<any>obj.hashLink.extra, 'hex');

                    obj.info.data.subsidy = Bignum.fromBuffer(Buffer.from(<any>obj.info.data.subsidy, 'hex'));
                    let info = ShareInfo.fromObject(obj.info);
                    let hashlink = HashLink.fromObject(obj.hashLink);

                    let share = new ShareVersionMapper[obj.VERSION](header, info, hashlink) as BaseShare;
                    share.refMerkleLink = obj.refMerkleLink.map(l => Buffer.from(<any>l, 'hex'));
                    share.merkleLink = obj.merkleLink.map(l => Buffer.from(<any>l, 'hex'));
                    share.gentxHash = Buffer.from(<any>obj.gentxHash, 'hex');
                    share.target = Bignum.fromBuffer(Buffer.from(<any>obj.target, 'hex'));
                    share.work = Bignum.fromBuffer(Buffer.from(<any>obj.work, 'hex'));
                    share.maxTarget = Bignum.fromBuffer(Buffer.from(<any>obj.maxTarget, 'hex'));
                    share.minWork = Bignum.fromBuffer(Buffer.from(<any>obj.minWork, 'hex'));
                    share.lastTxoutNonce = Bignum.fromBuffer(Buffer.from(<any>obj.lastTxoutNonce, 'hex'));
                    share.validity = obj.validity;
                    share.hash = obj.hash;

                    share.calcWeights();
                    shares.push(share);

                    if (filestream.bytesRead === size) {
                        filestream.close();
                        reader.close();
                    }
                });
            });

            allShares = allShares.concat(onePart);
        }

        return allShares;
    }

    static calcGlobalAttemptsPerSecond(hash: string, lookBehind: number, minWork = false) {
        let chain = Sharechain.Instance;

        let shares = Array.from(chain.subchain(hash, lookBehind, 'backward'));
        if (shares.length === 1) return minWork ? shares[0].minWork : shares[0].work;
        if (shares.length === 0) return new Bignum(0);

        let near = chain.get(hash);
        let far = shares[shares.length - 1];

        let attepmts = shares.reduce<Bignum>((p, c) => p.add(minWork ? c.minWork : c.work), new Bignum(0)).sub(minWork ? far.minWork : far.work);

        let elapsedTime = near.info.timestamp - far.info.timestamp;
        elapsedTime = elapsedTime <= 0 ? 1 : elapsedTime;

        return attepmts.div(elapsedTime);
    }
}