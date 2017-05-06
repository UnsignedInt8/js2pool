/*
 * Created on Sun Apr 16 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { BaseShare } from "./index";
import { Event } from "../../../nodejs/Event";
import ObservableProperty from "../../../nodejs/ObservableProperty";

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
    }

    private noParentShares = new Map<string, BaseShare>();
    private main = new Map<string, ShareNode>();
    private divergence: Sharechain;
    newest = ObservableProperty.init<BaseShare>(null);
    oldest = ObservableProperty.init<BaseShare>(null);

    constructor(isDivergence = false) {
        super();
        this.newest.onPropertyChanged(this.trigger.bind(this, Sharechain.Events.newestChanged, this));
        this.oldest.onPropertyChanged(this.trigger.bind(this, Sharechain.Events.oldestChanged, this));
        if (!isDivergence) this.divergence = new Sharechain(true);
    }

    onNewestChanged(callback: (sender: Sharechain) => void) {
        super.register(Sharechain.Events.newestChanged, callback);
    }

    hashes() {
        return this.main.keys();
    }

    has(share: BaseShare) {
        return this.main.has(share.hash);
    }

    add(share: BaseShare): boolean {
        if (this.main.has(share.hash)) return false;

        let parentNode = this.main.get(share.previousHash);
        if (parentNode) {
            // check whether this share is in main chain or not
            if (parentNode.next) {
                console.log('divergent share?');

                console.log('pn', parentNode.next);
                console.log('cur', this.newest.value.hash);
                console.log('div', share.hash);
                if (!this.divergence) return false;
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

        this.main.set(share.hash, node);

        if (!node.previous) {
            this.noParentShares.set(share.hash, share);
            this.oldest.set(share);
        }

        if (!node.next) this.newest.set(share);

        return true;
    }

    *subchain(startHash: string, length: number) {
        let hash = startHash;
        while (length--) {
            let item = this.main.get(hash);
            if (!item) return;

            yield item;
        }
    }

    size() {
        if (!this.newest.value) return 0;

        let count = 0;
        let hash = this.newest.value.hash;
        while (this.main.has(hash)) {
            hash = this.main.get(hash).previous;
            count++;
        }

        return count;
    }

    merge() {

    }
}