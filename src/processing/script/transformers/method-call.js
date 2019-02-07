// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createStringLiteral, createMethCallWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentMethod } from '../instrumented';

// Transform:
// obj.method(args...); obj[method](args...); -->
// _call$(obj, 'method', args...); _call$(obj, method, args...);

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.CallExpression],

    condition: node => {
        const callee = node.callee;

        if (callee.type === Syntax.MemberExpression) {
            if (callee.computed)
                return callee.property.type === Syntax.Literal ? shouldInstrumentMethod(callee.property.value) : true;

            return shouldInstrumentMethod(callee.property.name);
        }

        return false;
    },

    run: node => {
        const callee = node.callee;
        const method = callee.computed ? callee.property : createStringLiteral(callee.property.name);

        return createMethCallWrapper(callee.object, method, node.arguments);
    }
};
