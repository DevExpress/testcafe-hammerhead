// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { Identifier } from 'estree';
import { Transformer } from './index';
import INSTRUCTION from '../instruction';
import { createGetPostMessageMethodCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// const foo = postMessage; foo = postMessage; { _postMessage: postMessage }; return postMessage;
// -->
// const foo = _get$PostMessage(postMessage); foo = _get$PostMessage(postMessage); { _postMessage: _get$PostMessage(postMessage) }; return _get$PostMessage(postMessage);

const transformer: Transformer<Identifier> = {
    name: 'post-message-get',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.Identifier,

    condition: (node, parent) => {
        if (node.name !== 'postMessage' || !parent)
            return false;

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

        // Skip: function (postMessage) { ... } || function func(postMessage) { ... } || postMessage => { ... }
        if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration ||
             parent.type === Syntax.ArrowFunctionExpression) && parent.params.indexOf(node) !== -1)
            return false;

        // Skip: { postMessage: value }
        if (parent.type === Syntax.Property && parent.key === node)
            return false;

        // Skip: { postMessage }
        if (parent.type === Syntax.Property && parent.value === node && parent.shorthand)
            return false;

        // Skip: postMessage = value || function x (postMessage = value) { ... }
        if ((parent.type === Syntax.AssignmentExpression || parent.type === Syntax.AssignmentPattern) &&
            parent.left === node)
            return false;

        // Skip: const postMessage = value;
        if (parent.type === Syntax.VariableDeclarator && parent.id === node)
            return false;

        // Skip: postMessage++ || postMessage-- || ++postMessage || --postMessage
        if (parent.type === Syntax.UpdateExpression && (parent.operator === '++' || parent.operator === '--'))
            return false;

        // Skip already transformed: __get$PostMessage(postMessage) || __call$(obj, postMessage, args...);
        if (parent.type === Syntax.CallExpression && parent.callee.type === Syntax.Identifier &&
            (parent.callee.name === INSTRUCTION.getPostMessage ||
             parent.callee.name === INSTRUCTION.callMethod && parent.arguments[1] === node))
            return false;

        // Skip: function x (...postMessage) {}
        if (parent.type === Syntax.RestElement)
            return false;

        // Skip: export { postMessage } from "module";
        if (parent.type === Syntax.ExportSpecifier)
            return false;

        // Skip: import { postMessage } from "module";
        if (parent.type === Syntax.ImportSpecifier)
            return false;

        return true;
    },

    run: createGetPostMessageMethodCall,
};

export default transformer;
