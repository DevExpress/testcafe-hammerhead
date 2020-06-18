// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { Declaration, ForOfStatement, Pattern, Statement } from 'estree';
import { Transformer } from './index';
import { Syntax } from 'esotope-hammerhead';
import {
    createAssignmentExprStmt,
    createVariableDeclarator,
    createVariableDeclaration,
    createBlockStatement,
    createIdentifier
} from '../node-builder';
import replaceNode from './replace-node';
import TempVariables from './temp-variables';

// Transform:
// for (let {href, postMessage} of wins) {} -->
// for (let _hh$temp0 of wins) { let {href, postMessage} = _hh$temp0; }

const transformer: Transformer<ForOfStatement> = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.ForOfStatement,

    condition: node => {
        let left = node.left;

        if (left.type === Syntax.VariableDeclaration)
            left = left.declarations[0].id;

        return left.type === Syntax.ObjectPattern || left.type === Syntax.ArrayPattern;
    },

    run: node => {
        const tempIdentifier = createIdentifier(TempVariables.generateName());
        const forOfLeft      = node.left;

        let statementWithTempAssignment: Statement | Declaration;

        if (forOfLeft.type === Syntax.VariableDeclaration) {
            statementWithTempAssignment = createVariableDeclaration(forOfLeft.kind, [
                createVariableDeclarator(forOfLeft.declarations[0].id, tempIdentifier)
            ]);

            statementWithTempAssignment.reTransform = true;

            replaceNode(forOfLeft.declarations[0].id, tempIdentifier, forOfLeft.declarations[0], 'id');
        }
        else {
            const varDeclaration = createVariableDeclaration('var', [createVariableDeclarator(tempIdentifier)]);

            statementWithTempAssignment = createAssignmentExprStmt(forOfLeft as Pattern, tempIdentifier);

            replaceNode(forOfLeft, varDeclaration, node, 'left');
        }

        if (node.body.type === Syntax.BlockStatement)
            replaceNode(null, statementWithTempAssignment, node.body, 'body');
        else
            replaceNode(node.body, createBlockStatement([statementWithTempAssignment, node.body]), node, 'body');

        return null;
    }
};

export default transformer;
