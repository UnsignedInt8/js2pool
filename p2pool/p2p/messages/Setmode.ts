/*
 * Created on Sat Apr 08 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Payload } from "./Payload";

/**
 * Not used in P2Pool
 */
export default class Setmode extends Payload {
    mode: number; // 4 bytes
}