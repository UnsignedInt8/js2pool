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
    private unknownPreviousNodeShares = new Map<string, BaseShare>();
    private items = new Map<string, ShareNode>();
    private reversedItems = new Map<string, BaseShare>();
    head: BaseShare;
    tail: BaseShare;

    hashes() {
        return this.items.keys();
    }

    contains(hash: string) {
        return this.items.has(hash);
    }

    add(share: BaseShare) {
        let node = {
            next: null,
            previous: null,
            item: share,
        };

        if (this.unknownPreviousNodeShares.has(share.hash)) {
            let unkownPreviousShare = this.unknownPreviousNodeShares.get(share.hash);
            let nextNode = this.items.get(unkownPreviousShare.hash);
            nextNode.previous = share.hash;
            node.next = unkownPreviousShare.hash;
        }

        let previousNode = this.items.get(share.previousHash);
        if (previousNode) {
            node.previous = previousNode.item.hash;
            previousNode.next = share.hash;
        }

        this.items.set(share.hash, node);

        if (!node.previous) {
            this.unknownPreviousNodeShares.set(share.hash, share);
            this.tail = share;
        }

        if (!node.next) this.head = share;
    }

    *subchain(startHash: string, length: number) {
        let hash = startHash;
        while (length--) {
            let item = this.items.get(hash);
            if (!item) return;

            yield item;
        }
    }
}