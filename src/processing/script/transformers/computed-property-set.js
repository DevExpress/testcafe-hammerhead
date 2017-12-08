// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createComputedPropertySetWrapper } from '../node-builder';
import { Syntax } from '../tools/esotope';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj[prop] = value -->
// __set$(object, prop, value)

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.AssignmentExpression],

    condition: node => {
        const left = node.left;

        // super[prop] = value
        if (left.type === Syntax.MemberExpression && left.object.type === Syntax.Super)
            return false;

        if (node.operator === '=' && left.type === Syntax.MemberExpression && left.computed)
            return left.property.type === Syntax.Literal ? shouldInstrumentProperty(left.property.value) : true;

        return false;
    },

    run: node => createComputedPropertySetWrapper(node.left.property, node.left.object, node.right)
};
