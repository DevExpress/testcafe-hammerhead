// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import transformers from './transformers';

function transformChildNodes (node) {
    var changed = false;

    for (var key in node) {
        if (node.hasOwnProperty(key)) {
            var childNode = node[key];

            if (Object.prototype.toString.call(childNode) === '[object Array]') {
                for (var j = 0; j < childNode.length; j++)
                    changed = transform(childNode[j], node, key) || changed;
            }
            else
                changed = transform(childNode, node, key) || changed;
        }
    }

    return changed;
}

export default function transform (node, parent, key) {
    if (!node || typeof node !== 'object')
        return false;

    var nodeTransformers = transformers[node.type];
    var changed          = false;

    if (nodeTransformers) {
        for (var i = 0; i < nodeTransformers.length; i++) {
            var transformer = nodeTransformers[i];

            if (transformer.condition(node, parent)) {
                transformer.run(node, parent, key);

                changed = true;

                // NOTE: node was replaced by transformer
                if (parent[key] !== node) {
                    if (transformer.nodeReplacementRequireTransform)
                        return transform(parent[key], parent, key) || changed;

                    break;
                }
            }
        }
    }

    return transformChildNodes(node) || changed;
}
