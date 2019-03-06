// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/*eslint-disable no-unused-vars*/
import { AssignmentExpression, MemberExpression, Expression, CallExpression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createComputedPropertySetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj[prop] = value -->
// __set$(object, prop, value)

const transformer: Transformer = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.AssignmentExpression,

    condition: (node: AssignmentExpression): boolean => {
        const left = node.left;

        // super[prop] = value
        if (left.type === Syntax.MemberExpression && left.object.type === Syntax.Super)
            return false;

        if (node.operator === '=' && left.type === Syntax.MemberExpression && left.computed)
            return left.property.type === Syntax.Literal ? shouldInstrumentProperty(left.property.value) : true;

        return false;
    },

    run: (node: AssignmentExpression): CallExpression => {
        const memberExpression = <MemberExpression>node.left;

        return createComputedPropertySetWrapper(memberExpression.property, <Expression>memberExpression.object, node.right);
    }
};

export default transformer;
