// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { MemberExpression, Expression } from 'estree';
import { Transformer } from './index';
import { createComputedPropertyGetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj[prop] -->
// __get$(obj, prop)
const transformer: Transformer<MemberExpression> = {
    name: 'computed-property-get',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.MemberExpression,

    condition: (node, parent) => {
        if (!node.computed || !parent)
            return false;

        if (node.property.type === Syntax.Literal && !shouldInstrumentProperty(node.property.value))
            return false;

        // super[prop]
        if (node.object.type === Syntax.Super)
            return false;

        // object[prop] = value
        if (parent.type === Syntax.AssignmentExpression && parent.left === node)
            return false;

        // delete object[prop]
        if (parent.type === Syntax.UnaryExpression && parent.operator === 'delete')
            return false;

        // object[prop]++ || object[prop]-- || ++object[prop] || --object[prop]
        if (parent.type === Syntax.UpdateExpression && (parent.operator === '++' || parent.operator === '--'))
            return false;

        // object[prop]()
        if (parent.type === Syntax.CallExpression && parent.callee === node)
            return false;

        // new (object[prop])() || new (object[prop])
        if (parent.type === Syntax.NewExpression && parent.callee === node)
            return false;

        // for(object[prop] in source)
        if (parent.type === Syntax.ForInStatement && parent.left === node)
            return false;

        return true;
    },

    run: node => createComputedPropertyGetWrapper(node.property, node.object as Expression, node.optional),
};

export default transformer;
