// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import {
    BlockStatement,
    Declaration,
    ForOfStatement,
    Identifier,
    Node,
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

function findDeclarator (node: BlockStatement, predicate: Function): Node {
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
        if (predicate(identifier))
            return identifier;
    }

    return null;
}

function replaceDuplicateDeclarators (forOfNode: ForOfStatement) {
    const forOfLeft   = forOfNode.left as VariableDeclaration;
    let nodeToReplace = null;

    if (!forOfLeft.declarations.length || forOfLeft.declarations[0].id.type !== Syntax.ArrayPattern)
        return;

    if (forOfNode.body.type !== Syntax.BlockStatement)
        return;

    const leftIdentifiers = Object.values(forOfLeft.declarations[0].id.elements || []) as Array<Identifier>;

    const duplicateDeclator = findDeclarator(forOfNode.body as BlockStatement, node => {
        if (node.type !== Syntax.Identifier)
            return false;

        for (const identifier of leftIdentifiers) {
            if (identifier.name === node.name) {
                nodeToReplace = identifier;

                return true;
            }
        }

        return false;
    });

    if (duplicateDeclator) {
        const destIdentifier = createIdentifier(TempVariables.generateName());

        replaceNode(nodeToReplace, destIdentifier, forOfLeft.declarations[0].id, 'elements');
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
