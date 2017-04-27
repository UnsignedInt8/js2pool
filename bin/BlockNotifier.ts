#!/usr/bin/env node

import * as net from 'net';
import * as program from 'commander';

if (process.argv.length < 5) process.exit(1);

let host = process.argv[2];
let port = Number.parseInt(process.argv[3]);
let hash = process.argv[4];

try {
    let socket = net.connect({ port, host });
    socket.on('connect', () => socket.write(hash, () => socket.end()));
} catch (error) {
    console.error(error);
}