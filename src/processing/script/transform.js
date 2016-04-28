// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import transformers from './transformers';
import replaceNode from './transformers/replace-node';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var objectToString = Object.prototype.toString;

function addChange (changes, change) {
    if (changes.length) {
        var lastChange  = changes[changes.length - 1];
        var parsedStart = parseInt(change.start, 10);
        var parsedEnd   = parseInt(lastChange.end, 10);

        if (parsedStart > parsedEnd)
            changes.push(change);
        else if (change.start === lastChange.start && change.end === lastChange.end)
            changes[changes.length - 1] = change;
    }
    else
        changes.push(change);
}

function transformChildNodes (node, changes) {
    for (var key in node) {
        if (node.hasOwnProperty(key)) {
            var childNode = node[key];

            if (objectToString.call(childNode) === '[object Array]') {
                for (var j = 0; j < childNode.length; j++)
                    transform(childNode[j], node, key, changes);
            }
            else
                transform(childNode, node, key, changes);
        }
    }
}

export default function transform (node, parent, key, changes) {
    changes = changes || [];

    if (!node || typeof node !== 'object')
        return changes;

    var alreadyTransformed = node.originStart && node.originEnd;

    if (alreadyTransformed)
        addChange(changes, { start: node.originStart, end: node.originEnd, replacement: node });
    else {
        var nodeTransformers = transformers[node.type];

        if (nodeTransformers) {
            for (var i = 0; i < nodeTransformers.length; i++) {
                var transformer = nodeTransformers[i];

                if (transformer.condition(node, parent)) {
                    var replacement = transformer.run(node, parent, key);

                    if (replacement) {
                        replaceNode(node, replacement, parent, key);
                        addChange(changes, { start: replacement.originStart, end: replacement.originEnd, replacement });

                        if (transformer.nodeReplacementRequireTransform) {
                            transform(replacement, parent, key, changes);

                            return changes;
                        }

                        break;
                    }
                }
            }
        }
    }

    transformChildNodes(node, changes);

    return changes;
}
