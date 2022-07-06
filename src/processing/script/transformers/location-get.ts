// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { Identifier } from 'estree';
import { Transformer } from './index';
import { createLocationGetWrapper } from '../node-builder';
import INSTRUCTION from '../instruction';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// location -->
// __get$Loc(location)

const transformer: Transformer<Identifier> = {
    name: 'location-get',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.Identifier,

    condition: (node, parent) => {
        if (node.name !== 'location' || !parent)
            return false;

        // Skip: const location = value;
        if (parent.type === Syntax.VariableDeclarator && parent.id === node)
            return false;

        // Skip: location = value || function x (location = value) { ... }
        if ((parent.type === Syntax.AssignmentExpression || parent.type === Syntax.AssignmentPattern) &&
            parent.left === node)
            return false;

        // Skip: function location() {}
        if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration) &&
            parent.id === node)
            return false;

        // Skip: object.location || location.field
        if (parent.type === Syntax.MemberExpression && parent.property === node)
            return false;

        // Skip: { location: value }
        if (parent.type === Syntax.Property && parent.key === node)
            return false;

        // Skip: { location }
        if (parent.type === Syntax.Property && parent.value === node && parent.shorthand)
            return false;

        // Skip: location++ || location-- || ++location || --location
        if (parent.type === Syntax.UpdateExpression && (parent.operator === '++' || parent.operator === '--'))
            return false;

        // Skip: function (location) { ... } || function func(location) { ... } || location => { ... }
        if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration ||
             parent.type === Syntax.ArrowFunctionExpression) && parent.params.indexOf(node) !== -1)
            return false;

        // Skip already transformed: __get$Loc(location)
        if (parent.type === Syntax.CallExpression && parent.callee.type === Syntax.Identifier &&
            parent.callee.name === INSTRUCTION.getLocation)
            return false;

        // Skip: class X { location () {} }
        if (parent.type === Syntax.MethodDefinition)
            return false;

        // Skip: class location { x () {} }
        if (parent.type === Syntax.ClassDeclaration)
            return false;

        // Skip: function x (...location) {}
        if (parent.type === Syntax.RestElement)
            return false;

        // Skip: export { location } from "module";
        if (parent.type === Syntax.ExportSpecifier)
            return false;

        // Skip: import { location } from "module";
        if (parent.type === Syntax.ImportSpecifier)
            return false;

        return true;
    },

    run: createLocationGetWrapper,
};

export default transformer;
