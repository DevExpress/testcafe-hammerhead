// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createProcessScriptMethCall } from '../node-builder';
import replaceNode from './replace-node';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// eval(script); --> eval(__proc$Script(script));

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.CallExpression],

    condition: node => {
        if (!node.arguments.length)
            return false;

        // eval()
        if (node.callee.type === Syntax.Identifier && node.callee.name === 'eval')
            return true;

        // obj.eval(), obj['eval'](),
        return node.callee.type === Syntax.MemberExpression &&
               (node.callee.property.name || node.callee.property.value) === 'eval';
    },

    run: node => {
        const newArg = createProcessScriptMethCall(node.arguments[0]);

        replaceNode(node.arguments[0], newArg, node, 'arguments');

        return null;
    }
};
