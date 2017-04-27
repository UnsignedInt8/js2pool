

import * as assert from 'assert';
import * as Algos from "../core/Algos";

describe('Misc tests', () => {
    it('bits to target', () => {
        let target = Algos.bitsToTarget(0x1903a30c);
        assert.equal(target, 22829202948393929850749706076701368331072452018388575715328);
    })
})