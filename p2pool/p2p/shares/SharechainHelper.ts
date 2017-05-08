
import { BaseShare } from "./index";
import * as path from 'path';
import * as fs from 'fs';
import { Shares } from "../Messages/Shares";

/**
 * Data files name convention
 * shares_startheight_endheight
 */
export class SharechainHelper {

    private static appDir: string;
    private static dataDir: string;

    static init(coin: string) {
        let home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
        let appDir = path.resolve(home, '.js2pool');
        let dataDir = path.resolve(appDir, 'data', coin);
        SharechainHelper.appDir = appDir;
        SharechainHelper.dataDir = dataDir;

        if (!fs.existsSync(appDir)) {
            fs.mkdirSync(appDir);
        }

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }
    }

    static saveShares(shares: BaseShare[]) {
        if (!SharechainHelper.appDir) throw Error('not initialized');
        if (shares.length == 0) return;

        let filename = `shares_${shares.first().info.absheight}_${shares[shares.length - 1].info.absheight}`;
        let targetFile = path.resolve(SharechainHelper.dataDir, filename);
        if (fs.existsSync(targetFile)) return;

        let seralizableObjs = shares.map(share => {
            let obj = Object.assign(share) as BaseShare;
            obj.SUCCESSOR = null;
            obj.refMerkleLink = <any>obj.refMerkleLink.map(l => l.toString('hex'));
            obj.merkleLink = <any>obj.merkleLink.map(l => l.toString('hex'));
            obj.newScript = <any>obj.newScript.toString('hex');
            obj.gentxHash = <any>obj.gentxHash.toString('hex');
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
            return { filename: item, begin: Number.parseInt(items[1]), end: Number.parseInt(items[2]) };
        }).skipWhile(file => file.begin < fromAbsheight).takeWhile(file => file.end <= toAbsheight).select(file => file.filename).toArray();

        let shares = await new Promise<BaseShare[]>(resolve => {
            let shares = targetFiles
                .select(filename => Shares.fromBuffer(fs.readFileSync(path.resolve(SharechainHelper.dataDir, filename))))
                .select(wrapper => wrapper.shares.select(w => w.contents).flatten(true))
                .toArray();
            resolve(shares);
        });

        return shares;
    }
}