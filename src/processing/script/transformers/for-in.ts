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
    createVarDeclaration,
    createBlockExprStmt
} from '../node-builder';
import replaceNode from './replace-node';

// Transform:
// for(obj[prop] in src), for(obj.prop in src) -->
// for(const __set$temp in src) { obj[prop] = __set$temp; }

const transformer: Transformer = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.ForInStatement,

    condition: (node: ForInStatement) => node.left.type === Syntax.MemberExpression,

    run: (node: ForInStatement) => {
        const tempVarAst         = createTempVarIdentifier();
        const varDeclaration     = createVarDeclaration(tempVarAst);
        const assignmentExprStmt = createAssignmentExprStmt(<MemberExpression>node.left, tempVarAst);

        if (node.body.type !== Syntax.BlockStatement)
            replaceNode(node.body, createBlockExprStmt([assignmentExprStmt, node.body]), node, 'body');
        else
            replaceNode(null, assignmentExprStmt, node.body, 'body');

        replaceNode(node.left, varDeclaration, node, 'left');

        return null;
    }
};

export default transformer;
