// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import transformers from './transformers';
import replaceNode from './transformers/replace-node';
import { Syntax } from 'esotope-hammerhead';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const objectToString       = Object.prototype.toString;
const objectHasOwnProperty = Object.prototype.hasOwnProperty;

function getChange (node, parent, key) {
    return {
        start: node.originStart,
        end:   node.originEnd,
        index: Array.isArray(parent[key]) ? parent[key].indexOf(node) : -1,

        parent,
        key
    };
}

// NOTE: There is an issue with processing `new` expressions. `new a.src.b()` will be transformed
// to `new __get$(a, 'src').b()`, which is wrong. The correct result is `new (__get$(a, 'src')).b()`.
// To solve this problem, we add a 'state' entity. This entity stores the "new" expression, so that
// we can add it to the changes when the transformation is found.
function createState (currState, node, parent, key, hasTransformedAncestor) {
    const isNewExpression         = node.type === Syntax.NewExpression;
    const isNewExpressionAncestor = isNewExpression && !currState.newExpressionAncestor;

    return {
        hasTransformedAncestor:      currState.hasTransformedAncestor || hasTransformedAncestor,
        newExpressionAncestor:       isNewExpressionAncestor ? node : currState.newExpressionAncestor,
        newExpressionAncestorParent: isNewExpressionAncestor ? parent : currState.newExpressionAncestorParent,
        newExpressionAncestorKey:    isNewExpressionAncestor ? key : currState.newExpressionAncestorKey
    };
}

function transformChildNodes (node, changes, state) {
    for (const key in node) {
        if (objectHasOwnProperty.call(node, key)) {
            const childNode = node[key];

            if (objectToString.call(childNode) === '[object Array]') {
                for (let j = 0; j < childNode.length; j++)
                    transform(childNode[j], node, key, changes, state, false);
            }
            else
                transform(childNode, node, key, changes, state, false);
        }
    }
}

function isNodeTransformed (node: any) {
    return node.originStart !== void 0 && node.originEnd !== void 0;
}

function addChangeForTransformedNode (state: any, changes, replacement, parent, key) {
    let hasTransformedAncestor: any = state.hasTransformedAncestor;

    hasTransformedAncestor = hasTransformedAncestor || state.newExpressionAncestor && isNodeTransformed(state.newExpressionAncestor);

    if (!hasTransformedAncestor) {
        if (state.newExpressionAncestor) {
            replaceNode(state.newExpressionAncestor, state.newExpressionAncestor, state.newExpressionAncestorParent, state.newExpressionAncestorKey);
            changes.push(getChange(state.newExpressionAncestor, state.newExpressionAncestorParent, state.newExpressionAncestorKey));
        }
        else
            changes.push(getChange(replacement, parent, key));
    }
}

export default function transform (node, parent, key, changes, state, reTransform) {
    state   = state || {};
    changes = changes || [];

    if (!node || typeof node !== 'object')
        return null;

    let nodeChanged = false;

    if (isNodeTransformed(node) && !reTransform) {
        addChangeForTransformedNode(state, changes, node, parent, key);
        nodeChanged = true;
    }
    else {
        const nodeTransformers = transformers[node.type];

        if (nodeTransformers) {
            for (let i = 0; i < nodeTransformers.length; i++) {
                const transformer = nodeTransformers[i];

                if (transformer.condition(node, parent)) {
                    const replacement = transformer.run(node, parent, key);

                    if (replacement) {
                        replaceNode(node, replacement, parent, key);
                        nodeChanged = true;

                        addChangeForTransformedNode(state, changes, replacement, parent, key);

                        if (transformer.nodeReplacementRequireTransform) {
                            const newState = createState(state, replacement, parent, key, nodeChanged);

                            transform(replacement, parent, key, changes, newState, true);

                            return changes;
                        }

                        break;
                    }
                }
            }
        }
    }

    const childNodesState = createState(state, node, parent, key, nodeChanged);

    transformChildNodes(node, changes, childNodesState);

    return changes;
}
