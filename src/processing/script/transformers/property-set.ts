// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import {
    AssignmentExpression,
    MemberExpression,
    Expression,
    Identifier,
} from 'estree';

import { Transformer } from './index';
import { createPropertySetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj.<wrappable-property> = value -->
// __set$(obj, '<wrappable-property>', value)

const transformer: Transformer<AssignmentExpression> = {
    name: 'property-set',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.AssignmentExpression,

    condition: node => {
        // super.prop = value
        if (node.left.type === Syntax.MemberExpression && node.left.object.type === Syntax.Super)
            return false;

        return node.operator === '=' &&
               node.left.type === Syntax.MemberExpression && !node.left.computed &&
               node.left.property.type === Syntax.Identifier &&
               shouldInstrumentProperty(node.left.property.name);
    },

    run: node => {
        const memberExpression = node.left as MemberExpression;
        const identifier       = memberExpression.property as Identifier;

        return createPropertySetWrapper(identifier.name, memberExpression.object as Expression, node.right);
    },
};

export default transformer;
