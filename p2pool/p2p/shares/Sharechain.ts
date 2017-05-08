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
 * xxx a gap here xxx
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
    }

    private hashIndexer = new Map<string, number>();
    private absheightIndexer = new Map<number, Array<BaseShare>>();
    private _newest_ = ObservableProperty.init<BaseShare>(null);
    private merging = false;
    
    get newest() { return this._newest_.value; };

    private constructor() {
        super();
        this._newest_.onPropertyChanged(this.onNewestPropertyChanged.bind(this));
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

    onOldestChanged(callback: (sender: Sharechain, value: BaseShare) => void) {
        super.register(Sharechain.Events.oldestChanged, callback);
    }

    onCandidateArrived(callback: (sender: Sharechain, value: BaseShare) => void) {
        super.register(Sharechain.Events.candidateArrived, callback);
    }

    has(share: BaseShare) {
        return this.hashIndexer.has(share.hash);
    }

    add(share: BaseShare) {
        if (!share.validity) return;

        let shares = this.absheightIndexer.get(share.info.absheight);
        if (!shares) {
            shares = new Array<BaseShare>();
            this.absheightIndexer.set(share.info.absheight, shares);
        }

        if (shares.some(s => s.hash === share.hash)) return;
        logger.info(`height: ${share.info.absheight}`);
        shares.push(share);
        this.hashIndexer.set(share.hash, share.info.absheight);

        if (this._newest_.hasValue() && share.info.absheight > this._newest_.value.info.absheight) {
            let last = this._newest_.value;
            this._newest_.set(share);

            // check the previous share array whether has multiple items or not
            let previousShares = this.absheightIndexer.get(last.info.absheight);
            if (!previousShares) return;
            if (previousShares.length < 2) return;

            // find orphans
            let verified = previousShares.single(s => s.hash === share.info.data.previousShareHash);
            let orphans = previousShares.except([verified], (i1, i2) => i1.hash === i2.hash).toArray();
            this.trigger(Sharechain.Events.orphansFound, this, orphans);
            logger.info(`orphans found: ${orphans.length}, at ${last.info.absheight}`);

            // always keep the first element is on the main chain
            this.absheightIndexer.set(last.info.absheight, [verified].concat(orphans));
            return;
        }

        // as expereince, this share is verified by other nodes
        if (this._newest_.hasValue() && share.info.absheight === this._newest_.value.info.absheight) {
            this.trigger(Sharechain.Events.candidateArrived, this, share);
            return;
        }

        // an old share or some orphans in here or it is just a dead share
        if (this._newest_.hasValue() && share.info.absheight < this._newest_.value.info.absheight) {

            // just an old share arrived
            if (shares.length < 2) return;

            let nextHeight = share.info.absheight + 1;
            let nextShares = this.absheightIndexer.get(nextHeight);
            if (!nextShares || nextShares.length == 0) return;

            // dead share arrived
            if (!nextShares.some(s => s.info.data.previousShareHash == share.hash)) {
                this.trigger(Sharechain.Events.deadArrived, this, share);
                return;
            }

            // check orphans. if this happened, means someone is attacking p2pool network, or node's sharechain is stale
            let orphans = shares.except([share], (i1, i2) => i1.hash === i2.hash).toArray();
            this.trigger(Sharechain.Events.orphansFound, this, orphans);
            logger.warn(`old orphans found at ${share.info.absheight}`);

            // keep the first element is on the main chain
            this.absheightIndexer.set(share.info.absheight, [share].concat(orphans));
            return;
        }

        if (!this._newest_.hasValue()) this._newest_.set(share);
    }

    *subchain(startHash: string, length: number = Number.MAX_SAFE_INTEGER) {
        let absheight = this.hashIndexer.get(startHash);
        if (!absheight) return;

        while (length--) {
            let shares = this.absheightIndexer.get(absheight);
            if (!shares || shares.length == 0) return;

            let share = shares[0];
            absheight = share.info.absheight + 1;
            yield share;
        }
    }

    get length() {
        if (!this._newest_.hasValue()) return 0;

        let count = 0;
        let height = this._newest_.value.info.absheight;
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
        if (!this._newest_.hasValue()) return false;

        let count = 0;
        let hash = this._newest_.value.hash;
        let absheight = this._newest_.value.info.absheight;

        while (true) {
            let shares = this.absheightIndexer.get(absheight);
            if (!shares || shares.length == 0) break;

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

    }
}