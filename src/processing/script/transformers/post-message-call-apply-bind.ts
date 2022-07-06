// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import {
    CallExpression,
    Expression,
    MemberExpression,
} from 'estree';

import { Transformer } from './index';
import { createGetPostMessageMethodCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';

const INVOCATION_FUNC_NAME_RE = /^(call|apply|bind)$/;

// Transform:
// postMessage.call(ctx, script);
// postMessage.apply(ctx, script);
// postMessage.bind(...); -->
// __get$PostMessage(postMessage).call(ctx, script);
// __get$PostMessage(postMessage).apply(ctx, script);
// __get$PostMessage(postMessage).bind(...);

const transformer: Transformer<CallExpression> = {
    name: 'post-message-call-apply-bind',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.CallExpression,

    condition: node => {
        if (node.callee.type === Syntax.MemberExpression && node.callee.property.type === Syntax.Identifier &&
            INVOCATION_FUNC_NAME_RE.test(node.callee.property.name)) {
            // postMessage.<call|apply>(ctx, script, ...)
            if (node.arguments.length < 2 && node.callee.property.name !== 'bind')
                return false;

            const obj = node.callee.object;

            // obj.postMessage.<meth>(), obj[postMessage].<meth>(),
            if (obj.type === Syntax.MemberExpression &&
                (obj.property.type === Syntax.Identifier && obj.property.name ||
                 obj.property.type === Syntax.Literal && obj.property.value) === 'postMessage')
                return true;

            // postMessage.<meth>()
            if (obj.type === Syntax.Identifier && obj.name === 'postMessage')
                return true;
        }

        return false;
    },

    run: node => {
        const callee             = node.callee as MemberExpression;
        const getPostMessageNode = createGetPostMessageMethodCall(callee.object as Expression);

        replaceNode(callee.object, getPostMessageNode, callee, 'object');

        return null;
    },
};

export default transformer;
