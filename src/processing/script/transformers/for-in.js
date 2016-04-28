// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { Syntax } from '../tools/esotope';
import { createTempVarIdentifier, createAssignmentExprStmt, createVarDeclaration } from '../node-builder';
import replaceNode from './replace-node';

// Transform:
// for(obj[prop] in src), for(obj.prop in src) -->
// for(var __set$temp in src) { obj[prop] = __set$temp; }

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.ForInStatement],

    condition: node => node.left.type === Syntax.MemberExpression,

    run: node => {
        var tempVarAst         = createTempVarIdentifier();
        var varDeclaration     = createVarDeclaration(tempVarAst);
        var assignmentExprStmt = createAssignmentExprStmt(node.left, tempVarAst);

        replaceNode(null, assignmentExprStmt, node.body, 'body');
        replaceNode(node.left, varDeclaration, node, 'left');

        return null;
    }
};

