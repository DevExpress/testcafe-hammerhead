// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createGetStorageMethCall } from '../node-builder';
import INSTRUCTION from '../instruction';
import { Syntax } from '../tools/esotope';

// Transform:
// sessionStorage, localStorage -->
// __get$Storage(sessionStorage), __get$Storage(localStorage)

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.Identifier],

    condition: (node, parent) => {
        if (node.name !== 'sessionStorage' && node.name !== 'localStorage')
            return false;

        // Skip: function localStorage() {}
        if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration) &&
            parent.id === node)
            return false;

        // Skip: window.localStorage
        if (parent.type === Syntax.MemberExpression && parent.property === node)
            return false;

        // Skip: var localStorage = value;
        if (parent.type === Syntax.VariableDeclarator && parent.id === node)
            return false;

        // Skip: localStorage = value
        if (parent.type === Syntax.AssignmentExpression && parent.left === node)
            return false;

        // Skip: { localStorage: value }
        if (parent.type === Syntax.Property && parent.key === node)
            return false;

        // Skip: localStorage++ || localStorage-- || ++localStorage || --localStorage
        if (parent.type === Syntax.UpdateExpression && parent.operator === '++' || parent.operator === '--')
            return false;

        // Skip: function (localStorage) { ... } || function func(localStorage) { ... }
        if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration) &&
            parent.params.indexOf(node) !== -1)
            return false;

        // Skip already transformed: __get$Storage(localStorage)
        if (parent.type === Syntax.CallExpression && parent.callee.name === INSTRUCTION.getStorage)
            return false;

        return true;
    },

    run: node => createGetStorageMethCall(node.name)
};
