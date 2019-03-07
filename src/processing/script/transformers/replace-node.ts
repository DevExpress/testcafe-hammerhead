// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { Node } from 'estree';
import { NodeWithLocation } from '../transform';
/*eslint-enable no-unused-vars*/


export default function replaceNode (node: Node | Array<Node>, newNode: Node, parent: Node, key: string) {
    if (Array.isArray(parent[key])) {
        if (node) {
            const idx = parent[key].indexOf(node);

            parent[key][idx] = newNode;
        }
        else
            parent[key].unshift(newNode);
    }
    else
        parent[key] = newNode;

    const newNodeWithLocation = <NodeWithLocation>newNode;
    const nodeWithLocation    = <NodeWithLocation>node;
    const parentWithLocation  = <NodeWithLocation>parent;

    if (node) {
        newNodeWithLocation.originStart = newNodeWithLocation.start = nodeWithLocation.start;
        newNodeWithLocation.originEnd = newNodeWithLocation.end = nodeWithLocation.end;
    }
    else
        newNodeWithLocation.originStart = newNodeWithLocation.originEnd = parentWithLocation.start + 1;
}
