/*
 * Created on Fri Apr 07 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { Event } from '../nodejs/Event';
import * as assert from 'assert';

class EventTest extends Event {
    on(event: 'Hi', callback: () => void) {
        super.register(event, callback);
    }

    sayHi() {
        super.trigger('Hi');
    }
}

describe('Event Tests', () => {
    let e: EventTest;

    before(() => {
        e = new EventTest();
    });

    it('should raise a event', (done) => {
        e.on('Hi', () => {
            done();
        });

        e.sayHi();
    });

    it('should not raise any events', () => {
        assert.equal(e.removeAllEvents('Hi'), true);
    });
});