import * as fs from 'fs';
import * as commander from 'commander';
import * as kinq from 'kinq';
import * as path from 'path';

require('../nodejs/AsyncSocket');
kinq.enable();

type PackageInfo = {
    version: string,
};

let version = require('../../package.json').version;

let cmd = <any>commander.version(version)
    .option('-c, --config <path>', 'Configruation File Path', String)
    .parse(process.argv);

if (!cmd.config) {
    console.error('--config, no configuration file');
    process.exit(1);
}

if (!fs.existsSync(cmd.config)) {
    console.error('configuration file not found');
    process.exit(-1);
}

export default {
    config: cmd.config,  // configuration file path
}