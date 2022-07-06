// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { VariableDeclaration, VariableDeclarator } from 'estree';
import { Transformer } from './index';

import {
    createVariableDeclaration,
    createVariableDeclarator,
} from '../node-builder';

import { Syntax } from 'esotope-hammerhead';
import destructuring from '../destructuring';

// Transform:

// var { location: loc } = window,
//     [{ location }, item] = [window, 6],
// -->
// var _hh$temp0 = window,
//     loc = _hh$temp0.location,
//     _hh$temp1 = [window, 6],
//     _hh$temp1$0 = _hh$temp1[0],
//     location = _hh$temp1$0.location,
//     item = _hh$temp1[1];

// var [a, b] = c;
// -->
// var _hh$temp0 = __arrayFrom$(c),
//     a = _hh$temp0[0],
//     b = _hh$temp0[1];

const transformer: Transformer<VariableDeclaration> = {
    name: 'declaration-destructuring',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.VariableDeclaration,

    // @ts-ignore
    condition: (node, parent) => {
        // Skip: for (let { x } in some);
        if (parent?.type === Syntax.ForInStatement)
            return false;

        for (const declarator of node.declarations) {
            if (declarator.id.type === Syntax.ObjectPattern || declarator.id.type === Syntax.ArrayPattern)
                return true;
        }

        return false;
    },

    run: (node) => {
        const declarations = [] as VariableDeclarator[];

        for (const declarator of node.declarations) {
            destructuring(declarator.id, declarator.init || null, (pattern, value) =>
                declarations.push(createVariableDeclarator(pattern, value)));
        }

        return createVariableDeclaration(node.kind, declarations);
    },
};

export default transformer;
