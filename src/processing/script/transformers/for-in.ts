// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { ForInStatement, MemberExpression } from 'estree';
import { Transformer } from './index';
import { Syntax } from 'esotope-hammerhead';
import {
    createAssignmentExprStmt,
    createVariableDeclarator,
    createVariableDeclaration,
    createBlockStatement,
    createIdentifier,
} from '../node-builder';
import replaceNode from './replace-node';
import TempVariables from './temp-variables';

// Transform:
// for(obj[prop] in src), for(obj.prop in src) -->
// for(const _hh$temp0 in src) { obj[prop] = _hh$temp0; }

const transformer: Transformer<ForInStatement> = {
    name: 'for-in',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.ForInStatement,

    condition: node => node.left.type === Syntax.MemberExpression,

    run: node => {
        const tempVarAst         = createIdentifier(TempVariables.generateName());
        const varDeclaration     = createVariableDeclaration('var', [createVariableDeclarator(tempVarAst)]);
        const assignmentExprStmt = createAssignmentExprStmt(node.left as MemberExpression, tempVarAst);

        if (node.body.type !== Syntax.BlockStatement)
            replaceNode(node.body, createBlockStatement([assignmentExprStmt, node.body]), node, 'body');
        else
            replaceNode(null, assignmentExprStmt, node.body, 'body');

        replaceNode(node.left, varDeclaration, node, 'left');

        return null;
    },
};

export default transformer;
