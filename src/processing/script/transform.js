// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import transformers from './transformers';
import replaceNode from './transformers/replace-node';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var objectToString = Object.prototype.toString;

function getChange (node, parent, key) {
    return {
        start: node.originStart,
        end:   node.originEnd,
        index: Array.isArray(parent[key]) ? parent[key].indexOf(node) : -1,

        parent,
        key
    };
}

function transformChildNodes (node, changes, parentChanged) {
    for (var key in node) {
        if (node.hasOwnProperty(key)) {
            var childNode = node[key];

            if (objectToString.call(childNode) === '[object Array]') {
                for (var j = 0; j < childNode.length; j++)
                    transform(childNode[j], node, key, changes, parentChanged);
            }
            else
                transform(childNode, node, key, changes, parentChanged);
        }
    }
}

export default function transform (node, parent, key, changes, parentChanged) {
    var nodeChanged = false;

    changes = changes || [];

    if (!node || typeof node !== 'object')
        return changes;

    var alreadyTransformed = node.originStart && node.originEnd;

    if (alreadyTransformed && !parentChanged) {
        changes.push(getChange(node, parent, key));
        nodeChanged = true;
    }
    else {
        var nodeTransformers = transformers[node.type];

        if (nodeTransformers) {
            for (var i = 0; i < nodeTransformers.length; i++) {
                var transformer = nodeTransformers[i];

                if (transformer.condition(node, parent)) {
                    var replacement = transformer.run(node, parent, key);

                    if (replacement) {
                        replaceNode(node, replacement, parent, key);
                        nodeChanged = true;

                        if (!parentChanged)
                            changes.push(getChange(replacement, parent, key));

                        if (transformer.nodeReplacementRequireTransform) {
                            transform(replacement, parent, key, changes, nodeChanged || parentChanged);

                            return changes;
                        }

                        break;
                    }
                }
            }
        }
    }

    transformChildNodes(node, changes, nodeChanged || parentChanged);

    return changes;
}
