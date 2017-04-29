#!/usr/bin/env node

import * as fs from 'fs';
import * as commander from 'commander';
import { StratumServer, StratumServerOptions, DefaultMinersManager } from '../pool/stratum';
import cmd from './ArgsParser';

let opts = JSON.parse(fs.readFileSync(cmd.config).toString('utf8')) as StratumServerOptions;

let minersManager = new DefaultMinersManager();
minersManager.initDiff = opts.initDiff;

let ss = new StratumServer(opts, minersManager);
ss.onReady(() => ss.start());