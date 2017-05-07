/*
 * Created on Sun Apr 16 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { BaseShare } from "./index";
import { Event } from "../../../nodejs/Event";
import ObservableProperty from "../../../nodejs/ObservableProperty";
import * as kinq from 'kinq';

type ShareNode = {
    next?: string;
    previous?: string;
    item: BaseShare;
}

export default class Sharechain extends Event {

    static readonly CHAIN_LENGTH = 24 * 60 * 60 / 10;

    static readonly Events = {
        newestChanged: 'NewestChanged',
        oldestChanged: 'OldestChanged',
        deadArrived: 'DeadArrived',
        orphanFound: 'OrphanFound',
    }

    private noParentShares = new Map<string, BaseShare>();
    private main = new Map<string, ShareNode>();
    private divergence: Sharechain;
    newest = ObservableProperty.init<BaseShare>(null);
    oldest = ObservableProperty.init<BaseShare>(null);

    constructor() {
        super();
        this.newest.onPropertyChanged(this.trigger.bind(this, Sharechain.Events.newestChanged, this));
        this.oldest.onPropertyChanged(this.trigger.bind(this, Sharechain.Events.oldestChanged, this));
    }

    onNewestChanged(callback: (sender: Sharechain) => void) {
        super.register(Sharechain.Events.newestChanged, callback);
    }

    onOldestChanged(callback: (sender: Sharechain) => void) {
        super.register(Sharechain.Events.oldestChanged, callback);
    }

    hashes() {
        return this.main.keys();
    }

    has(share: BaseShare) {
        return this.main.has(share.hash);
    }

    add(share: BaseShare): boolean {
        if (!share.validity) return false;
        if (this.main.has(share.hash)) return false;

        console.log(share.info.absheight);
        let parentNode = this.main.get(share.previousShareHash);
        if (parentNode) {
            if (parentNode.next) {
                if (share.info.absheight < this.newest.value.info.absheight) {
                    this.trigger(Sharechain.Events.deadArrived, this, share);
                    return false;
                }

                console.log('divergent share?');
                console.log('pn', parentNode.item.info.absheight);
                console.log('div', share.info.absheight);
                if (!this.divergence) this.divergence = new Sharechain();
                return this.divergence.add(share);
            }
            else {
                parentNode.next = share.hash;
            }
        }

        let node = {
            next: null,
            previous: parentNode ? parentNode.item.hash : null,
            item: share,
        };

        if (this.noParentShares.has(share.hash)) {
            let noParentShare = this.noParentShares.get(share.hash);
            let childNode = this.main.get(noParentShare.hash);
            childNode.previous = share.hash;
            node.next = noParentShare.hash;
            this.noParentShares.delete(share.hash);
        }

        if (!node.previous) {
            if (this.divergence && share.info.absheight >= this.height()) {
                this.divergence.add(share);
                return this.merge();
            }

            if (!this.oldest.hasValue()) {
                this.oldest.set(share);
            } else {
                if (share.info.absheight >= this.oldest.value.info.absheight) return false;
                this.noParentShares.set(share.previousShareHash, share);
                this.oldest.set(share);
                this.main.set(share.hash, node);
                console.log('update the oldest share', share.info.absheight);
                return true;
            }
        }

        this.main.set(share.hash, node);
        if (!node.next && share.info.absheight > this.height()) this.newest.set(share);

        return true;
    }

    *subchain(startHash: string, length: number = Number.MAX_SAFE_INTEGER) {
        let hash = startHash;

        while (length--) {
            let item = this.main.get(hash);
            if (!item) return;
            
            hash = item.next;
            yield item;
        }
    }

    size() {
        if (!this.newest.hasValue()) return 0;

        let count = 0;
        let hash = this.newest.value.hash;
        while (this.main.has(hash)) {
            hash = this.main.get(hash).previous;
            count++;
        }

        return count;
    }

    merge() {
        if (!this.divergence) return false;
        if (this.divergence.size() < 3) return false;

        let divergencePoint = this.findAbsHeightNode(this.divergence.oldest.value.info.absheight);
        if (!divergencePoint) return false;

        console.log('begin mergeing');
        let mainLength = this.lengthSince(divergencePoint.item.hash);
        if (mainLength > this.divergence.size()) {
            console.log('mainchain is longer');
            this.divergence = null;
            return false;
        }

        console.log('merge divergence to main');
        let parentNode = this.main.get(divergencePoint.previous);
        if (!parentNode) {
            console.log('no common parent? merging failed');
            return false;
        }

        for (let deperecatedNode of this.subchain(parentNode.next)) {
            this.main.delete(deperecatedNode.item.hash);
        }
        this.newest.set(parentNode.item);

        parentNode.next = null;
        for (let node of this.divergence.subchain(this.divergence.oldest.value.hash)) {
            this.add(node.item);
        }

        this.divergence.clean();
        this.divergence = null;
        return true;
    }

    lengthSince(hash: string) {
        let point = this.main.get(hash);
        if (!point) return 0;

        let length = 0;
        do {
            length++;
            point = this.main.get(point.next);
        } while (point);

        return length;
    }

    findAbsHeightNode(height: number) {
        if (this.newest.hasValue()) {
            let node = this.main.get(this.newest.value.hash);
            do {
                if (node.item.info.absheight === height) return node;
                node = this.main.get(node.previous);
            } while (node);
        }

        return kinq.toLinqable(this.main.values()).firstOrDefault(v => v.item.info.absheight == height, null);
    }

    height() {
        return this.newest.hasValue() ? this.newest.value.info.absheight : 0;
    }

    clean() {
        this.main.clear();
        this.removeAllEvents();
        this.newest.set(null);
        this.oldest.set(null);
    }

    onDeadShareArrived(callback: (sender: Sharechain, deadShare: BaseShare) => void) {
        super.register(Sharechain.Events.deadArrived, callback);
    }

    onOrphanFound(callback: (sender: Sharechain, orphan: BaseShare) => void) {
        super.register(Sharechain.Events.orphanFound, callback);
    }
}