// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { Syntax } from '../tools/esotope';
import { createTempVarIdentifier, createAssignmentExprStmt, createVarDeclaration, createBlockExprStmt } from '../node-builder';
import replaceNode from './replace-node';
// Transform:
// for(obj[prop] in src), for(obj.prop in src) -->
// for(const __set$temp in src) { obj[prop] = __set$temp; }
export default {
    nodeReplacementRequireTransform: false,
    nodeTypes: [Syntax.ForInStatement],
    condition: node => node.left.type === Syntax.MemberExpression,
    run: node => {
        const tempVarAst = createTempVarIdentifier();
        const varDeclaration = createVarDeclaration(tempVarAst, void 0);
        const assignmentExprStmt = createAssignmentExprStmt(node.left, tempVarAst);
        if (node.body.type !== Syntax.BlockStatement)
            replaceNode(node.body, createBlockExprStmt([assignmentExprStmt, node.body]), node, 'body');
        else
            replaceNode(null, assignmentExprStmt, node.body, 'body');
        replaceNode(node.left, varDeclaration, node, 'left');
        return null;
    }
};
