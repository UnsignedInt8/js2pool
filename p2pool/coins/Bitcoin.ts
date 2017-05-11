/*
 * Created on Sat Apr 15 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Algos } from "../../core/Algos";
import * as Bignum from 'bignum';

export default class Bitcoin {
    static readonly SHARE_PERIOD = 30; //# seconds
    static readonly CHAIN_LENGTH = 24 * 60 * 60;//10 # shares
    static readonly REAL_CHAIN_LENGTH = 24 * 60 * 60;//10 # shares
    static readonly TARGET_LOOKBEHIND = 200;// # shares
    static readonly SPREAD = 3;// # blocks
    static readonly IDENTIFIER = Buffer.from('fc70035c7a81bc6f', 'hex');
    static readonly MSGPREFIX = Buffer.from('2472ef181efcd37b', 'hex');
    static readonly P2P_PORT = 9333;
    static readonly MIN_TARGET = 0;
    static readonly MAX_TARGET = new Bignum(2).pow(256).div(new Bignum(2).pow(32)).sub(1); // 2 ** 256 / 2 ** 32 - 1
    static readonly PERSIST = true;
    static readonly WORKER_PORT = 9332;
    static readonly BOOTSTRAP_ADDRS = 'forre.st vps.forre.st portals94.ns01.us 54.227.25.14 119.1.96.99 204.10.105.113 76.104.150.248 89.71.151.9 76.114.13.54 72.201.24.106 79.160.2.128 207.244.175.195 168.7.116.243 94.23.215.27 218.54.45.177 5.9.157.150 78.155.217.76 91.154.90.163 173.52.43.124 78.225.49.209 220.135.57.230 169.237.101.193:8335 98.236.74.28 204.19.23.19 98.122.165.84:8338 71.90.88.222 67.168.132.228 193.6.148.18 80.218.174.253 50.43.56.102 68.13.4.106 24.246.31.2 176.31.208.222 1.202.128.218 86.155.135.31 204.237.15.51 5.12.158.126:38007 202.60.68.242 94.19.53.147 65.130.126.82 184.56.21.182 213.112.114.73 218.242.51.246 86.173.200.160 204.15.85.157 37.59.15.50 62.217.124.203 80.87.240.47 198.61.137.12 108.161.134.32 198.154.60.183:10333 71.39.52.34:9335 46.23.72.52:9343 83.143.42.177 192.95.61.149 144.76.17.34 46.65.68.119 188.227.176.66:9336 75.142.155.245:9336 213.67.135.99 76.115.224.177 50.148.193.245 64.53.185.79 80.65.30.137 109.126.14.42 76.84.63.146 62.213.58.41 61.219.119.37 209.195.4.74 114.32.105.215 221.15.35.2 78.46.88.136 211.100.23.119 84.75.252.230 123.243.155.184:9350 68.193.128.182'.split(' ');
    static readonly ANNOUNCE_CHANNEL = '#p2pool';
    static readonly SOFTFORKS_REQUIRED = new Set(['bip65', 'csv', 'segwit']);
    static readonly MINIMUM_PROTOCOL_VERSION = 1600;
    static readonly NEW_MINIMUM_PROTOCOL_VERSION = 1700;
    static readonly SEGWIT_ACTIVATION_VERSION = 17;
    static readonly POWFUNC: (data: Buffer) => Buffer = Algos.sha256d.hash();
}

Object.freeze(Bitcoin);