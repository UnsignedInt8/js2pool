/*
 * Created on Sun Apr 16 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import logger from '../../misc/Logger';
import { BaseShare, Share, SegwitShare } from "../p2p/shares/index";
import { Event } from "../../nodejs/Event";
import ObservableProperty from "../../nodejs/ObservableProperty";

type ShareNode = {
    next?: string;
    previous?: string;
    item: BaseShare;
}

export type Gap = {
    descendent: string,
    descendentHeight: number,
    length: number
}

/**
 * Sharechain
 * 
 * 'x' stands for main chain shares
 * '-' stands for orphans or deads
 * 
 * [x]
 * [x][-]
 * [x]
 * [x]
 * xxx a gap here xxx (length: 1)
 * [x][-][-]
 * [x][-]
 * [x]
 */

export default class Sharechain extends Event {

    static readonly Instance = new Sharechain();
    static readonly CALC_CHAIN_LENGTH = 24 * 60 * 60 / 10;
    static readonly MAX_CHAIN_LENGTH = Sharechain.CALC_CHAIN_LENGTH * 2;

    static readonly Events = {
        newestChanged: 'NewestChanged',
        oldestChanged: 'OldestChanged',
        deadArrived: 'DeadArrived',
        candidateArrived: 'CandidateArrived',
        orphansFound: 'OrphansFound',
        gapsFound: 'GapsFound',
        chainCalculatable: 'ChainCalculatable',
    }

    private hashIndexer = new Map<string, number>();
    private absheightIndexer = new Map<number, Array<BaseShare | Share | SegwitShare>>();
    newest = ObservableProperty.init<BaseShare | Share | SegwitShare>(null);
    oldest: BaseShare | Share | SegwitShare;
    calculatable = false;
    verified = false;

    private constructor() {
        super();
        this.newest.onPropertyChanged(this.onNewestPropertyChanged.bind(this));
    }

    private onNewestPropertyChanged(oldValue: BaseShare, newValue: BaseShare) {
        this.trigger(Sharechain.Events.newestChanged, this, newValue);
    }

    onDeadShareArrived(callback: (sender: Sharechain, deadShare: BaseShare) => void) {
        super.register(Sharechain.Events.deadArrived, callback);
    }

    onOrphansFound(callback: (sender: Sharechain, orphans: BaseShare[]) => void) {
        super.register(Sharechain.Events.orphansFound, callback);
    }

    onNewestChanged(callback: (sender: Sharechain, value: BaseShare) => void) {
        super.register(Sharechain.Events.newestChanged, callback);
    }

    onCandidateArrived(callback: (sender: Sharechain, value: BaseShare) => void) {
        super.register(Sharechain.Events.candidateArrived, callback);
    }

    onGapsFound(callback: (sender: Sharechain, gaps: Gap[]) => void) {
        super.register(Sharechain.Events.gapsFound, callback);
    }

    onChainCalculatable(callback: (sender: Sharechain) => void) {
        super.register(Sharechain.Events.chainCalculatable, callback);
    }

    has(hash: string) {
        return this.hashIndexer.has(hash);
    }

    /**
     * Return a share by hash or absheight
     */
    get(id: string | number) {
        let height = id;

        if (typeof id === 'string') {
            if (!this.hashIndexer.has(id)) return null;
            height = this.hashIndexer.get(id);
        }

        let shares = this.absheightIndexer.get(<number>height);
        if (!shares || shares.length === 0) return null;
        return shares[0];
    }

    add(shares: Iterable<BaseShare | Share | SegwitShare>) {
        for (let share of shares) {
            this.append(share);
        }
    }

    /**
     * if returns ture, means it's a new share, and it can be broadcasted to other peers
     * if returns false, means it's **an old** or invalid share, and it should not be broadcasted to other peers
     */
    append(share: BaseShare | Share | SegwitShare) {
        if (!share.validity) {
            logger.warn(`invalid share, ${share.info.absheight}, ${share.hash}`);
            return false;
        }

        if (this.newest.hasValue() && share.info.absheight < this.newest.value.info.absheight - Sharechain.MAX_CHAIN_LENGTH) return false;

        let shares = this.absheightIndexer.get(share.info.absheight);
        if (!shares) {
            shares = new Array<BaseShare>();
            this.absheightIndexer.set(share.info.absheight, shares);
        }

        if (shares.some(s => s.hash === share.hash)) return false;

        shares.push(share);
        this.hashIndexer.set(share.hash, share.info.absheight);
        if (this.oldest && share.info.absheight < this.oldest.info.absheight) this.oldest = share;

        if (this.newest.hasValue() && share.info.absheight > this.newest.value.info.absheight) {

            this.newest.set(share);
            this.cleanDeprecations();

            // check the previous share array whether has multiple items or not
            let previousShares = this.absheightIndexer.get(share.info.absheight - 1);

            if (!previousShares) {
                // find a gap
                super.trigger(Sharechain.Events.gapsFound, this, [{ descendent: share.hash, descendentHeight: share.info.absheight, length: 1 }]);
                return true;
            }

            if (previousShares.length < 2) return true;

            // find orphans, maybe a gap in here
            let verified = previousShares.singleOrDefault(s => s.hash === share.info.data.previousShareHash, null);
            if (verified) {
                let orphans = previousShares.except([verified], (i1, i2) => i1.hash === i2.hash).toArray();
                if (orphans.length > 0) this.trigger(Sharechain.Events.orphansFound, this, orphans);
                this.absheightIndexer.set(share.info.absheight - 1, [verified].concat(orphans)); // always keep the first element on the main chain
            } else {
                super.trigger(Sharechain.Events.gapsFound, this, [{ descendent: share.hash, descendentHeight: share.info.absheight, length: 1 }])
            }

            return true;
        }

        // as expereince, this share is verified by other nodes
        if (this.newest.hasValue() && share.info.absheight === this.newest.value.info.absheight) {
            let nextShares = this.absheightIndexer.get(share.info.absheight + 1);

            if (!nextShares || nextShares[0].info.data.previousShareHash === share.hash) {
                shares.pop();
                this.absheightIndexer.set(share.info.absheight, [share].concat(shares))
                this.trigger(Sharechain.Events.candidateArrived, this, share);
            }

            return true;
        }

        // an old share or some orphans in here or it is just a dead share
        if (this.newest.hasValue() && share.info.absheight < this.newest.value.info.absheight) {

            // just an old share arrived
            if (shares.length < 2) return true;

            let nextHeight = share.info.absheight + 1;
            let nextShares = this.absheightIndexer.get(nextHeight);
            if (!nextShares || nextShares.length == 0) {
                // this.trigger(Sharechain.Events.gapsFound, this, [{descendent: }])
                return;
            }

            // dead share arrived
            if (!nextShares.some(s => s.info.data.previousShareHash == share.hash)) {
                this.trigger(Sharechain.Events.deadArrived, this, share);
                return false;
            }

            // check orphans. if this happened, means someone is attacking p2pool network, or node's sharechain is stale
            let orphans = shares.except([share], (i1, i2) => i1.hash === i2.hash).toArray();
            if (orphans.length > 0) this.trigger(Sharechain.Events.orphansFound, this, orphans);

            // keep the first element is on the main chain
            this.absheightIndexer.set(share.info.absheight, [share].concat(orphans));
            return false;
        }

        if (!this.newest.hasValue()) this.newest.set(share);
        if (!this.oldest) this.oldest = share;

        return true;
    }

    cleanDeprecations() {
        if (!this.newest.hasValue() || !this.oldest) return;
        if (this.newest.value.info.absheight - this.oldest.info.absheight < Sharechain.MAX_CHAIN_LENGTH) return;
        let deprecatedShares = this.absheightIndexer.get(this.oldest.info.absheight);
        if (!deprecatedShares || deprecatedShares.length === 0) return;

        let nextOldestHeight = this.oldest.info.absheight;
        let newestHeight = this.newest.value.info.absheight;
        this.absheightIndexer.delete(this.oldest.info.absheight);
        for (let ds of deprecatedShares) this.hashIndexer.delete(ds.hash);
        this.oldest = null;

        while (nextOldestHeight++ < newestHeight) {
            if (!this.absheightIndexer.has(nextOldestHeight)) continue;
            this.oldest = this.absheightIndexer.get(nextOldestHeight)[0];
            break;
        }
    }

    fix() {
        for (let [height, shares] of Array.from(this.absheightIndexer).sort((a, b) => b[0] - a[0])) {
            let current = shares[0];
            let parents = this.absheightIndexer.get(current.info.absheight - 1);
            if (!parents || parents.length <= 1) continue;

            if (parents[0].hash === current.info.data.previousShareHash) continue;
            let target = parents.singleOrDefault(p => p.hash === current.info.data.previousShareHash, null);
            if (!target) continue;

            let others = parents.except([target], (i1, i2) => i1.hash === i2.hash).toArray();
            this.absheightIndexer.set(current.info.absheight - 1, [target].concat(others));
        }
    }

    *subchain(startHash: string, length: number = Number.MAX_SAFE_INTEGER, direction: 'backward' | 'forward' = 'backward') {
        let absheight = this.hashIndexer.get(startHash);
        if (!absheight) return;

        let step = direction === 'backward' ? -1 : 1;

        while (length--) {
            let shares = this.absheightIndexer.get(absheight);
            if (!shares || shares.length === 0) return;

            let share = shares[0];
            absheight = share.info.absheight + step;
            yield share;
        }
    }

    get length() {
        if (!this.newest.hasValue()) return 0;

        let count = 0;
        let height = this.newest.value.info.absheight;
        while (this.absheightIndexer.has(height)) {
            count++;
            height--;
        }

        return count;
    }

    get size() {
        return this.absheightIndexer.size;
    }

    // check all first elements are on the main chain
    verify() {
        if (!this.newest.hasValue()) return false;

        let verified = 0;
        let hash = this.newest.value.hash;
        let absheight = this.newest.value.info.absheight;

        while (absheight > (Math.min(this.oldest ? this.oldest.info.absheight : this.newest.value.info.absheight - Sharechain.MAX_CHAIN_LENGTH))) {
            let shares = this.absheightIndexer.get(absheight);
            if (!shares || shares.length === 0) break;

            let share = shares[0];
            if (hash != share.hash) break;

            verified++;
            absheight = share.info.absheight - 1;
            hash = share.info.data.previousShareHash;
        }

        if (!this.calculatable) {
            this.calculatable = verified == this.length && verified >= Sharechain.CALC_CHAIN_LENGTH;
            if (this.calculatable) super.trigger(Sharechain.Events.chainCalculatable, this, verified);
        }

        this.verified = this.calculatable = verified >= Sharechain.CALC_CHAIN_LENGTH && this.length >= Sharechain.CALC_CHAIN_LENGTH;
        logger.info(`sharechain verified: ${verified}, length: ${this.length}, size: ${this.size}, calculatable: ${this.calculatable}`);

        return this.verified;
    }

    checkGaps() {
        if (!this.newest.hasValue()) return;

        let gaps = new Array<Gap>();
        let child = this.newest.value;

        for (let [parentHeight, shares] of Array.from(this.absheightIndexer).sort((a, b) => b[0] - a[0]).take(Sharechain.CALC_CHAIN_LENGTH + 1).skip(1)) {

            if (parentHeight + 1 !== child.info.absheight || shares[0].hash !== child.info.data.previousShareHash) {
                let length = child.info.absheight - parentHeight + 1;
                console.log('error share', shares[0].hash, shares[0].info.absheight, 'total length', shares.length);

                gaps.push({ descendent: child.hash, length: length, descendentHeight: child.info.absheight });
            }

            child = shares[0];
        }

        if (this.oldest && this.newest.hasValue() && this.newest.value.info.absheight - this.oldest.info.absheight < Sharechain.CALC_CHAIN_LENGTH) {
            gaps.push({
                descendent: this.oldest.hash,
                descendentHeight: this.oldest.info.absheight,
                length: Sharechain.CALC_CHAIN_LENGTH - (this.newest.value.info.absheight - this.oldest.info.absheight) + 1,
            });
        }

        if (gaps.length > 0) super.trigger(Sharechain.Events.gapsFound, this, gaps);

        return gaps;
    }
}