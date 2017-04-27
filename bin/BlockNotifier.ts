#!/usr/bin/env node

import * as net from 'net';

if (process.argv.length < 2) process.exit(1);

let host = process.argv[0];  // Task pushing server
let port = Number.parseInt(process.argv[1]);
let hash = process.argv[2];

console.log(process.argv);
net.connect({ port, host }).write(hash);