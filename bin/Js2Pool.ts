#!/usr/bin/env node

import * as fs from 'fs';
import * as net from 'net';
import * as program from 'commander';
import params from './ArgsParser';
import { AppOptions, App } from "../p2pool/App";

let opts = JSON.parse(fs.readFileSync(params.config, 'utf8')) as AppOptions;
App(opts);
