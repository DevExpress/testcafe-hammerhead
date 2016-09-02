// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createGetPostMessageMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';
import replaceNode from './replace-node';

const INVOCATION_FUNC_NAME_RE = /^(call|apply)$/;

// Transform:
// postMessage.call(ctx, script);
// postMessage.apply(ctx, script); -->
// __get$PostMessage(postMessage).call(ctx, script);
// __get$PostMessage(postMessage).apply(ctx, script);

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.CallExpression],

    condition: node => {
        // postMessage.<meth>(ctx, script, ...)
        if (node.arguments.length < 2)
            return false;

        if (node.callee.type === Syntax.MemberExpression && INVOCATION_FUNC_NAME_RE.test(node.callee.property.name)) {
            var obj = node.callee.object;

            // obj.postMessage.<meth>(), obj[postMessage].<meth>(),
            if (obj.type === Syntax.MemberExpression && (obj.property.value || obj.property.name) === 'postMessage')
                return true;

            // postMessage.<meth>()
            if (obj.name === 'postMessage')
                return true;
        }

        return false;
    },

    run: node => {
        var nodeX = createGetPostMessageMethCall(node.callee.object);

        replaceNode(node.callee.object, nodeX, node.callee, 'object');

        return null;
    }
};
