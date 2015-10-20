// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createStringLiteral, createMethCallWrapper, replaceNode } from '../ast';
import { Syntax } from '../parsing-tools';
import { shouldInstrumentMethod } from '../instrumented';

// Transform:
// obj.method(args...); obj[method](args...); -->
// _call$(obj, 'method', args...); _call$(obj, method, args...);

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.CallExpression],

    condition: node => {
        var callee = node.callee;

        if (callee.type === Syntax.MemberExpression) {
            if (callee.computed) {
                return callee.property.type === Syntax.Literal ?
                       shouldInstrumentMethod(callee.property.value) :
                       true;
            }

            return shouldInstrumentMethod(callee.property.name);
        }

        return false;
    },

    run: (node, parent, key) => {
        var callee  = node.callee;
        var meth    = callee.computed ? callee.property : createStringLiteral(callee.property.name);
        var newNode = createMethCallWrapper(callee.object, meth, node.arguments);

        replaceNode(node, newNode, parent, key);
    }
};
