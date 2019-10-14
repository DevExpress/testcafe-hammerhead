// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { Node } from 'estree';
/*eslint-enable no-unused-vars*/

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
    else
        newNode.originStart = newNode.originEnd = parent.start! + 1; /* eslint-disable-line @typescript-eslint/no-non-null-assertion */
}
