/*
 * Created on Fri Apr 07 2017 UnsignedInt8
 * https://en.bitcoin.it/wiki/P2Pool#Protocol_description
 */

import Addrs from "./Addrs";
import Addrme from "./AddrMe";
import { Version } from './Version';
import { Ping, Pong } from "./Ping";
import { Payload } from "./Payload";
import Getaddrs from "./GetAddrs";
import { Have_tx, Losing_tx, Forget_tx } from "./Have_tx";
import Sharereq from "./Sharereq";
import Sharereply from "./Sharereply";
import { Remember_tx } from "./Remember_tx";

export const Payloads = {
    'version': Version,
    'ping': Ping,
    'pong': Pong,
    'addrme': Addrme,
    'getaddrs': Getaddrs,
    'addrs': Addrs,
    'sharereq': Sharereq,
    'sharereply': Sharereply,
    'have_tx': Have_tx,
    'losing_tx': Losing_tx,
    'remember_tx': Remember_tx,
    'forget_tx': Forget_tx,
}
