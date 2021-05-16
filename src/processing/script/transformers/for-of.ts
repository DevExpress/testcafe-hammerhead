// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import {
    ArrayPattern,
    BlockStatement,
    Declaration,
    ForOfStatement,
    Identifier,
    Pattern,
    Statement,
    VariableDeclaration
} from 'estree';

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

function walkDeclarators (node: BlockStatement, action: (identifier: Identifier) => void): void {
    const declarators = [];
    const identifiers = [];

    for (const statement of node.body) {
        if (statement.type === Syntax.VariableDeclaration)
            declarators.push(...statement.declarations);
    }

    for (const declarator of declarators) {
        if (declarator.type === Syntax.VariableDeclarator) {
            if (declarator.id.type === Syntax.Identifier)
                identifiers.push(declarator.id);

            if (declarator.id.type === Syntax.ArrayPattern)
                identifiers.push(...declarator.id.elements);

            if (declarator.id.type === Syntax.ObjectPattern)
                for (const prop of declarator.id.properties)
                    identifiers.push(prop.value);
        }
    }

    for (const identifier of identifiers) {
        if (identifier.type === Syntax.Identifier)
            action(identifier);
    }
}

function replaceDuplicateDeclarators (forOfNode: ForOfStatement) {
    const forOfLeft      = forOfNode.left as VariableDeclaration;
    const nodesToReplace = [];

    const isArrayPatternDeclaration = forOfLeft.declarations[0]?.id.type === Syntax.ArrayPattern;
    const isBlockStatement          = forOfNode.body.type === Syntax.BlockStatement;

    if (!isArrayPatternDeclaration || !isBlockStatement)
        return;

    const leftDeclaration = forOfLeft.declarations[0].id as ArrayPattern;
    const leftIdentifiers = leftDeclaration.elements as Identifier[];

    walkDeclarators(forOfNode.body as BlockStatement, (node: Identifier) => {
        for (const identifier of leftIdentifiers)
            if (identifier.name === node.name)
                nodesToReplace.push(identifier);
    });

    for (const nodeToReplace of nodesToReplace) {
        const destIdentifier = createIdentifier(TempVariables.generateName());

        replaceNode(nodeToReplace, destIdentifier, leftDeclaration, 'elements');
    }
}

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
            replaceDuplicateDeclarators(node);

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
