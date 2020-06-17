// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { Node } from 'estree';

export default function replaceNode<T extends Node> (node: Node | null, newNode: Node, parent: T, key: keyof T) {
    const oldNode = parent[key];

    if (oldNode instanceof Array) {
        if (node)
            oldNode[oldNode.indexOf(node)] = newNode;
        else
            oldNode.unshift(newNode);
    }
    else {
        // @ts-ignore
        parent[key] = newNode;
    }

    if (node) {
        newNode.originStart = newNode.start = node.start;
        newNode.originEnd = newNode.end = node.end;
    }
    else {
        /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
        newNode.start = newNode.end = newNode.originStart = newNode.originEnd = oldNode[1] ? oldNode[1].start! : parent.start! + 1;
    }
}
