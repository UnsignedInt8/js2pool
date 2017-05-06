/*
 * Created on Sun Apr 16 2017 UnsignedInt8
 * Github: https://github.com/unsignedint8
 */

import { BaseShare } from "./index";
import { Event } from "../../../nodejs/Event";

type ShareNode = {
    next?: string;
    previous?: string;
    item: BaseShare;
}

export default class Sharechain extends Event {
    private noParentShares = new Map<string, BaseShare>();
    private main = new Map<string, ShareNode>();
    private divergence = new Sharechain();
    newest: BaseShare;
    oldest: BaseShare;

    hashes() {
        return this.main.keys();
    }

    contains(hash: string) {
        return this.main.has(hash);
    }

    add(share: BaseShare) {
        let parentNode = this.main.get(share.previousHash);
        if (parentNode) {
            // check whether this share is in main chain or not
            if (parentNode.next) {
                this.divergence.add(share);
                return;
            }
            else {
                console.log('found parent share');
                parentNode.next = share.hash;
            }
        }

        let node = {
            next: null,
            previous: parentNode ? parentNode.item.hash : null,
            item: share,
        };

        if (this.noParentShares.has(share.hash)) {
            console.log('found a no parent share');
            let noParentShare = this.noParentShares.get(share.hash);
            let childNode = this.main.get(noParentShare.hash);
            childNode.previous = share.hash;
            node.next = noParentShare.hash;

            this.noParentShares.delete(share.hash);
        }

        this.main.set(share.hash, node);

        if (!node.previous) {
            this.noParentShares.set(share.hash, share);
            this.oldest = share;
        }

        if (!node.next) this.newest = share;
    }

    *subchain(startHash: string, length: number) {
        let hash = startHash;
        while (length--) {
            let item = this.main.get(hash);
            if (!item) return;

            yield item;
        }
    }
}