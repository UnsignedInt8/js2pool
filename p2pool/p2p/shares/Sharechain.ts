/*
 * Created on Sun Apr 16 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import logger from '../../../misc/Logger';
import { BaseShare } from "./index";
import { Event } from "../../../nodejs/Event";
import ObservableProperty from "../../../nodejs/ObservableProperty";

type ShareNode = {
    next?: string;
    previous?: string;
    item: BaseShare;
}

export type Gap = {
    descendent: string,
    descendentHeight: number,
    length: number,
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
    static readonly CHAIN_LENGTH = 24 * 60 * 60 / 10;
    static readonly MAX_CHAIN_LENGTH = Sharechain.CHAIN_LENGTH * 3;

    static readonly Events = {
        newestChanged: 'NewestChanged',
        oldestChanged: 'OldestChanged',
        deadArrived: 'DeadArrived',
        candidateArrived: 'CandidateArrived',
        orphansFound: 'OrphansFound',
        gapsFound: 'GapsFound',
    }

    private hashIndexer = new Map<string, number>();
    private absheightIndexer = new Map<number, Array<BaseShare>>();
    private merging = false;
    newest = ObservableProperty.init<BaseShare>(null);

    private constructor() {
        super();
        this.newest.onPropertyChanged(this.onNewestPropertyChanged.bind(this));
    }

    private onNewestPropertyChanged(oldValue: BaseShare, newValue: BaseShare) {
        if (this.merging) return;
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

    has(hash: string) {
        return this.hashIndexer.has(hash);
    }

    /**
     * if returns ture, means it's a new share, and it can be broadcasted to other peers
     * if returns false, means it's **an old** or invalid share, and it should not be broadcasted to other peers
     */
    add(share: BaseShare) {
        if (!share.validity) return false;

        let shares = this.absheightIndexer.get(share.info.absheight);
        if (!shares) {
            shares = new Array<BaseShare>();
            this.absheightIndexer.set(share.info.absheight, shares);
        }

        if (shares.some(s => s.hash === share.hash)) return false;
        shares.push(share);
        this.hashIndexer.set(share.hash, share.info.absheight);

        if (this.newest.hasValue() && share.info.absheight > this.newest.value.info.absheight) {
            let last = this.newest.value;
            this.newest.set(share);

            // find gaps
            if (!this.absheightIndexer.has(share.info.absheight - 1))
                super.trigger(Sharechain.Events.gapsFound, this, [{ descendent: share.hash, descendentHeight: share.info.absheight, length: 1 }]);

            // check the previous share array whether has multiple items or not
            let previousShares = this.absheightIndexer.get(last.info.absheight);
            if (!previousShares) return true;
            if (previousShares.length < 2) return true;

            // find orphans
            let verified = previousShares.single(s => s.hash === share.info.data.previousShareHash);
            let orphans = previousShares.except([verified], (i1, i2) => i1.hash === i2.hash).toArray();
            if (orphans.length > 0) this.trigger(Sharechain.Events.orphansFound, this, orphans);

            // always keep the first element is on the main chain
            this.absheightIndexer.set(last.info.absheight, [verified].concat(orphans));

            return true;
        }

        // as expereince, this share is verified by other nodes
        if (this.newest.hasValue() && share.info.absheight === this.newest.value.info.absheight) {
            this.trigger(Sharechain.Events.candidateArrived, this, share);
            return true;
        }

        // an old share or some orphans in here or it is just a dead share
        if (this.newest.hasValue() && share.info.absheight < this.newest.value.info.absheight) {

            // just an old share arrived
            if (shares.length < 2) return false;

            let nextHeight = share.info.absheight + 1;
            let nextShares = this.absheightIndexer.get(nextHeight);
            if (!nextShares || nextShares.length == 0) return;

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
        return true;
    }

    *subchain(startHash: string, length: number = Number.MAX_SAFE_INTEGER) {
        let absheight = this.hashIndexer.get(startHash);
        if (!absheight) return;

        while (length--) {
            let shares = this.absheightIndexer.get(absheight);
            if (!shares || shares.length === 0) return;

            let share = shares[0];
            absheight = share.info.absheight + 1;
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

        let count = 0;
        let hash = this.newest.value.hash;
        let absheight = this.newest.value.info.absheight;

        while (true) {
            let shares = this.absheightIndexer.get(absheight);
            if (!shares || shares.length === 0) break;

            let share = shares[0];
            if (hash != share.hash) break;

            count++;
            absheight = share.info.absheight - 1;
            hash = share.info.data.previousShareHash;
        }

        logger.info(`verifying ${count}, ${this.length}`);
        return count === this.length;
    }

    checkGaps() {
        if (!this.newest.hasValue()) return;

        let gaps = new Array<Gap>();
        let descendentHeight = this.newest.value.info.absheight;

        for (let ancestorHeight of Array.from(this.absheightIndexer.keys()).sort((a, b) => b - a).skip(1)) {
            if (ancestorHeight + 1 === descendentHeight) continue;

            let length = descendentHeight - ancestorHeight - 1;
            gaps.push({ descendent: this.absheightIndexer.get(descendentHeight)[0].hash, length, descendentHeight });
        }

        if (gaps.length > 0) super.trigger(Sharechain.Events.gapsFound, this, gaps);
    }
}