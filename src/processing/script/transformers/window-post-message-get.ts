// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { MemberExpression } from 'estree';
import { Transformer } from './index';
import INSTRUCTION from '../instruction';
import { createGetPostMessageMethodCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// const foo = window.postMessage; foo = window.postMessage; { _postMessage: window.postMessage }; return window.postMessage;
// -->
// const foo = _get$PostMessage(window.postMessage); foo = _get$PostMessage(window.postMessage); { _postMessage: _get$PostMessage(window.postMessage) }; return _get$PostMessage(window.postMessage);

const transformer: Transformer<MemberExpression> = {
    name: 'window-post-message-get',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.MemberExpression,

    condition: (node, parent) => {
        if (!parent)
            return false;

        // Skip: window.postMessage.field
        if (parent.type === Syntax.MemberExpression && (parent.property === node || parent.object === node))
            return false;

        // Skip: window.postMessage()
        if (parent.type === Syntax.CallExpression && parent.callee === node)
            return false;

        // Skip: window.postMessage = 1, window["postMessage"] = 1
        if (parent.type === Syntax.AssignmentExpression && parent.left === node)
            return false;

        // Skip already transformed: __get$PostMessage(window.postMessage), __get$PostMessage(window["postMessage"])
        if (parent.type === Syntax.CallExpression && parent.callee.type === Syntax.Identifier &&
            parent.callee.name === INSTRUCTION.getPostMessage)
            return false;

        // window.postMessage
        if (node.property.type === Syntax.Identifier && node.property.name === 'postMessage')
            return true;

        // window['postMessage']
        if (node.property.type === Syntax.Literal && node.property.value === 'postMessage')
            return true;

        return false;
    },

    run: createGetPostMessageMethodCall,
};

export default transformer;
