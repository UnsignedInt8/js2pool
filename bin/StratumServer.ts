#!/usr/bin/env node

import * as fs from 'fs';
import * as commander from 'commander';
import packageInfo from './PackageInfo';
import { StratumServer, StratumServerOptions, DefaultMinersManager } from '../pool/stratum';
import cmd from './ArgsParser';

let opts = JSON.parse(fs.readFileSync(cmd.config).toString('utf8')) as StratumServerOptions;

let ss = new StratumServer(opts, new DefaultMinersManager());
ss.onReady(() => ss.start());