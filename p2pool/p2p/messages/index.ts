/*
 * Created on Fri Apr 07 2017 UnsignedInt8
 * https://en.bitcoin.it/wiki/P2Pool#Protocol_description
 */

import Addrs from "./Addrs";
import Addrme from "./AddrMe";
import Version from './Version';
import { Ping, Pong } from "./Ping";
import { Payload } from "./Payload";
import Getaddrs from "./GetAddrs";
import { Have_tx } from "./Have_tx";

export const Payloads = {
    'version': Version,
    'ping': Ping,
    'pong': Pong,
    'addrme': Addrme,
    'addrs': Addrs,
    'getaddrs': Getaddrs,
    'have_tx': Have_tx,
}
