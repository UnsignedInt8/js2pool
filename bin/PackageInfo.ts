import * as fs from 'fs';

type PackageInfo = {
    version: string,
};

export default JSON.parse(fs.readFileSync('../../package.json').toString('utf8')) as PackageInfo;