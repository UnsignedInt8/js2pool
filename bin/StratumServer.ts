#!/usr/bin/env node

import * as commander from 'commander';
import packageInfo from './PackageInfo';

let cmd = <any>commander.version(packageInfo.version)
    .option('-c, --config', 'Configuration File Path')
    .parse(process.argv);

