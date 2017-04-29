#!/usr/bin/env node

import * as fs from 'fs';
import * as net from 'net';
import cmd from './ArgsParser';
import * as commander from 'commander';
import { TaskServerOptions, TaskServer } from '../pool/task/';

let opts = JSON.parse(fs.readFileSync(cmd.config).toString()) as TaskServerOptions;

new TaskServer(opts);