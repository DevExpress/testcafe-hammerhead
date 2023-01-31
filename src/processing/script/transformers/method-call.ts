// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import {
    CallExpression,
    MemberExpression,
    Expression,
    Literal,
    Identifier,
    SimpleCallExpression,
} from 'estree';

import { Transformer } from './index';
import { createSimpleLiteral, createMethodCallWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentMethod } from '../instrumented';

// Transform:
// obj.method(args...); obj[method](args...); -->
// _call$(obj, 'method', args...); _call$(obj, method, args...);

const transformer: Transformer<CallExpression> = {
    name: 'method-call',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.CallExpression,

    condition: node => {
        const callee = node.callee;

        if (callee.type === Syntax.MemberExpression) {
            // Skip: super.meth()
            if (callee.object.type === Syntax.Super)
                return false;

            if (callee.computed)
                return callee.property.type === Syntax.Literal ? shouldInstrumentMethod(callee.property.value) : true;

            return callee.property.type === Syntax.Identifier && shouldInstrumentMethod(callee.property.name);
        }

        return false;
    },

    run: node => {
        const callee   = node.callee as MemberExpression;
        const method   = callee.computed
            ? callee.property as Literal
            : createSimpleLiteral((callee.property as Identifier).name); // eslint-disable-line no-extra-parens
        const optional = (node as SimpleCallExpression).optional;

        return createMethodCallWrapper(callee.object as Expression, method, node.arguments, optional);
    },
};

export default transformer;
