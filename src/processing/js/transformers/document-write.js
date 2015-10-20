// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createStringLiteral } from '../ast';
import INTERNAL_LITERAL from '../internal-literal';
import { Syntax } from '../parsing-tools';

function isDocumentWriteStmt (stmt) {
    return stmt.type === Syntax.ExpressionStatement &&
           stmt.expression.type === Syntax.CallExpression &&
           stmt.expression.callee.type === Syntax.MemberExpression &&
           (stmt.expression.callee.property.name === 'write' ||
            stmt.expression.callee.property.name === 'writeln');
}

function getDocumentWriteStmtIndices (stmts) {
    var indices = [];

    for (var i = 0; i < stmts.length; i++) {
        if (isDocumentWriteStmt(stmts[i]))
            indices.push(i);
    }

    return indices;
}

// Transform:

// obj.write(html); obj.writeln(html);  -->
// obj.write(html, __begin$); obj.writeln(html, __end$);

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [
        Syntax.BlockStatement,
        Syntax.Program
    ],

    condition: node => getDocumentWriteStmtIndices(node.body).length > 1,

    run: node => {
        var indices   = getDocumentWriteStmtIndices(node.body);
        var firstExpr = node.body[indices[0]].expression;
        var lastExpr  = node.body[indices[indices.length - 1]].expression;

        firstExpr.arguments.push(createStringLiteral(INTERNAL_LITERAL.documentWriteBegin));
        lastExpr.arguments.push(createStringLiteral(INTERNAL_LITERAL.documentWriteEnd));
    }
};
