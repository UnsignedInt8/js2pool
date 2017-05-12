/*
 * Created on Thu May 11 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import * as Bignum from 'bignum';

export function clip<T extends Bignum | number>(value: T, min: T, max: T) {
    if (typeof value === 'number') {
        return value < min ? min : (value > max ? max : value);
    }

    return (<Bignum>value).lt(min) ? min : ((<Bignum>value).gt(max) ? max : value);
}

export function shuffle<T>(a: Iterable<T>) {
    let shuffled = Array.from(a);

    for (let i = shuffled.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [shuffled[i - 1], shuffled[j]] = [shuffled[j], shuffled[i - 1]];
    }

    return shuffled;
}