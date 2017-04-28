import * as fs from 'fs';
import * as commander from 'commander';
import packageInfo from './PackageInfo';

let cmd = <any>commander.version(packageInfo.version)
    .option('-c, --config', 'Configruation File Path')
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