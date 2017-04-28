#!/usr/bin/env node

import * as fs from 'fs';
import * as net from 'net';
import * as commander from 'commander';
import { TaskServerOptions, TaskServer } from "../pool/task/index";
import cmd from './CommandParser';

let opts = JSON.parse(fs.readFileSync(cmd.config).toString()) as TaskServerOptions;

new TaskServer(opts);