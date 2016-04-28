// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

export default function replaceNode (node, newNode, parent, key) {
    if (Array.isArray(parent[key])) {
        if (node) {
            var idx = parent[key].indexOf(node);

            parent[key][idx] = newNode;
        }
        else
            parent[key].unshift(newNode);
    }
    else
        parent[key] = newNode;

    if (node) {
        newNode.originStart = newNode.start = node.start;
        newNode.originEnd = newNode.end = node.end;
    }
    else {
        var parentStart = parseInt(parent.start, 10) + 1;

        newNode.originStart = newNode.originEnd = parentStart;
    }
}
