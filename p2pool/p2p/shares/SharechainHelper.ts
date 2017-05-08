
import { BaseShare } from "./index";
import * as path from 'path';
import * as fs from 'fs';

export class SharechainHelper {

    private static appDir: string;
    private static dataDir: string;

    static init() {
        let home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
        let appDir = path.resolve(home, '.js2pool');
        let dataDir = path.resolve(appDir, 'data');
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

    }

    static loadShares(fromAbsheight: number = 0, toAbsheight: number = 0) {
        if (!SharechainHelper.appDir) throw Error('not initialized');
        if (toAbsheight <= fromAbsheight) return [];

    }
}