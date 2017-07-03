// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import INSTRUCTION from '../instruction';
import { createGetPostMessageMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';

// Transform:
// var foo = postMessage; foo = postMessage; { _postMessage: postMessage }; return postMessage;
// -->
// var foo = _get$PostMessage(postMessage); foo = _get$PostMessage(postMessage); { _postMessage: _get$PostMessage(postMessage) }; return _get$PostMessage(postMessage);

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.Identifier],

    condition: (node, parent) => {
        if (node.name === 'postMessage') {
            // Skip: window.postMessage, postMessage.call
            if (parent.type === Syntax.MemberExpression)
                return false;

            // Skip: class X { postMessage () {} }
            if (parent.type === Syntax.MethodDefinition)
                return false;

            // Skip: class postMessage { x () {} }
            if (parent.type === Syntax.ClassDeclaration)
                return false;

            // Skip: function postMessage () { ... }
            if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration) &&
                parent.id === node)
                return false;

            // Skip: function (postMessage) { ... } || function func(postMessage) { ... }
            if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration) &&
                parent.params.indexOf(node) !== -1)
                return false;

            // Skip: { postMessage: value }
            if (parent.type === Syntax.Property && parent.key === node)
                return false;

            // Skip: postMessage = value
            if (parent.type === Syntax.AssignmentExpression && parent.left === node)
                return false;

            // Skip: var postMessage = value;
            if (parent.type === Syntax.VariableDeclarator && parent.id === node)
                return false;

            // Skip: postMessage++ || postMessage-- || ++postMessage || --postMessage
            if (parent.type === Syntax.UpdateExpression && parent.operator === '++' || parent.operator === '--')
                return false;

            // Skip already transformed: __get$PostMessage(postMessage) || __call$(obj, postMessage, args...);
            if (parent.type === Syntax.CallExpression && (parent.callee.name === INSTRUCTION.getPostMessage ||
                                                          parent.callee.name === INSTRUCTION.callMethod &&
                                                          parent.arguments[1] === node))
                return false;

            return true;
        }

        return false;
    },

    run: createGetPostMessageMethCall
};
