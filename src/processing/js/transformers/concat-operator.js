// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createExpandedConcatOperation, replaceNode } from '../ast';
import { Syntax } from '../parsing-tools';

// Transform:
// val1 += val2
// --> val1 = val1 + val2

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.AssignmentExpression],

    condition: node => node.operator === '+=',

    run: (node, parent, key) => {
        var newNode = createExpandedConcatOperation(node.left, node.right);

        replaceNode(node, newNode, parent, key);
    }
};
