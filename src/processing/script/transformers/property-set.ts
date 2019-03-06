// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { AssignmentExpression, CallExpression, MemberExpression, Expression, Identifier } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createPropertySetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj.<wrappable-property> = value -->
// __set$(obj, '<wrappable-property>', value)

const transformer: Transformer = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.AssignmentExpression,

    condition: (node: AssignmentExpression) => {
        // super.prop = value
        if (node.left.type === Syntax.MemberExpression && node.left.object.type === Syntax.Super)
            return false;

        return node.operator === '=' &&
               node.left.type === Syntax.MemberExpression && !node.left.computed &&
               node.left.property.type === Syntax.Identifier &&
               shouldInstrumentProperty(node.left.property.name);
    },

    run: (node: AssignmentExpression): CallExpression => {
        const memberExpression = <MemberExpression>node.left;
        const identifier       = <Identifier>memberExpression.property;

        return createPropertySetWrapper(identifier.name, <Expression>memberExpression.object, node.right);
    }
};

export default transformer;
