// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import {
    AssignmentExpression,
    MemberExpression,
    Expression,
} from 'estree';

import { Transformer } from './index';
import { createComputedPropertySetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj[prop] = value -->
// __set$(object, prop, value)

const transformer: Transformer<AssignmentExpression> = {
    name: 'computed-property-set',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.AssignmentExpression,

    condition: node => {
        const left = node.left;

        // super[prop] = value
        if (left.type === Syntax.MemberExpression && left.object.type === Syntax.Super)
            return false;

        if (node.operator === '=' && left.type === Syntax.MemberExpression && left.computed)
            return left.property.type === Syntax.Literal ? shouldInstrumentProperty(left.property.value) : true;

        return false;
    },

    run: node => {
        const memberExpression = node.left as MemberExpression;

        return createComputedPropertySetWrapper(memberExpression.property, memberExpression.object as Expression, node.right);
    },
};

export default transformer;
