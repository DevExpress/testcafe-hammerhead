// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createExpandedConcatOperation } from '../node-builder';
import { Syntax } from '../tools/esotope';

// Transform:
// val1 += val2
// --> val1 = val1 + val2

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.AssignmentExpression],

    condition: node => node.operator === '+=',

    run: node => createExpandedConcatOperation(node.left, node.right)
};
