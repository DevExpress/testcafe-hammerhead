// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createProcessScriptMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';
import replaceNode from './replace-node';

// Transform:
// new Function(params..., body); -->
// new Function(params..., __proc$Script(body));

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.NewExpression],

    condition: node => node.callee.name === 'Function' && node.arguments.length,

    run: node => {
        var lastArgIndex = node.arguments.length - 1;
        var newArg       = createProcessScriptMethCall(node.arguments[lastArgIndex]);

        replaceNode(node.arguments[lastArgIndex], newArg, node, 'arguments');

        return null;
    }
};
