// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createComputedPropertySetWrapper, replaceNode } from '../ast';
import { Syntax } from '../parsing-tools';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj[prop] = value -->
// __set$(object, prop, value)

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.AssignmentExpression],

    condition: node => {
        var left = node.left;

        if (node.operator === '=' && left.type === Syntax.MemberExpression && left.computed)
            return left.property.type === Syntax.Literal ? shouldInstrumentProperty(left.property.value) : true;

        return false;
    },

    run: (node, parent, key) => {
        var newNode = createComputedPropertySetWrapper(node.left.property, node.left.object, node.right);

        replaceNode(node, newNode, parent, key);
    }
};
