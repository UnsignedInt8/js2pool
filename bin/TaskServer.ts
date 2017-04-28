#!/usr/bin/env node

import * as net from 'net';
import * as commander from 'commander';
import * as fs from 'fs';
import { TaskServerOptions, TaskServer } from "../pool/task/index";

let packageInfo = JSON.parse(fs.readFileSync('../../package.json').toString('utf8'));

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

let opts = JSON.parse(fs.readFileSync(cmd.config).toString()) as TaskServerOptions;

new TaskServer(opts);