// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createLocationGetWrapper } from '../node-builder';
import INSTRUCTION from '../instruction';
import { Syntax } from '../tools/esotope';

// Transform:
// location -->
// __get$Loc(location)

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.Identifier],

    condition: (node, parent) => {
        if (node.name !== 'location')
            return false;

        // Skip: var location = value;
        if (parent.type === Syntax.VariableDeclarator && parent.id === node)
            return false;

        // Skip: location = value
        if (parent.type === Syntax.AssignmentExpression && parent.left === node)
            return false;

        // Skip: function location() {}
        if (parent.type === Syntax.FunctionDeclaration && parent.id === node)
            return false;

        // Skip: object.location || location.field
        if (parent.type === Syntax.MemberExpression)
            return false;

        // Skip: { location: value }
        if (parent.type === Syntax.Property && parent.key === node)
            return false;

        // Skip: location++ || location-- || ++location || --location
        if (parent.type === Syntax.UpdateExpression && parent.operator === '++' || parent.operator === '--')
            return false;

        // Skip: function (location) { ... } || function func(location) { ... }
        if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration) &&
            parent.params.indexOf(node) !== -1)
            return false;

        // Skip already transformed: __get$Loc(location)
        if (parent.type === Syntax.CallExpression && parent.callee.name === INSTRUCTION.getLocation)
            return false;

        return true;
    },

    run: () => createLocationGetWrapper()
};
