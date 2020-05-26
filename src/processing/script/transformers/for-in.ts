// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { ForInStatement, MemberExpression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { Syntax } from 'esotope-hammerhead';
import {
    createTempVarIdentifier,
    createAssignmentExprStmt,
    createVariableDeclarator,
    createVariableDeclaration,
    createBlockStatement
} from '../node-builder';
import replaceNode from './replace-node';

// Transform:
// for(obj[prop] in src), for(obj.prop in src) -->
// for(const __set$temp in src) { obj[prop] = __set$temp; }

const transformer: Transformer<ForInStatement> = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.ForInStatement,

    condition: node => node.left.type === Syntax.MemberExpression,

    run: node => {
        const tempVarAst         = createTempVarIdentifier();
        const varDeclaration     = createVariableDeclaration('var', [createVariableDeclarator(tempVarAst)]);
        const assignmentExprStmt = createAssignmentExprStmt(node.left as MemberExpression, tempVarAst);

        if (node.body.type !== Syntax.BlockStatement)
            replaceNode(node.body, createBlockStatement([assignmentExprStmt, node.body]), node, 'body');
        else
            replaceNode(null, assignmentExprStmt, node.body, 'body');

        replaceNode(node.left, varDeclaration, node, 'left');

        return null;
    }
};

export default transformer;
