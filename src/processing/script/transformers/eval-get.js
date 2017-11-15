// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import INSTRUCTION from '../instruction';
import { createGetEvalMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';

// Transform:
// const foo = eval; foo = eval; { _eval: eval }; return eval;
// -->
// const foo = _get$Eval(eval); foo = _get$Eval(eval); { _eval: _get$Eval(eval) }; return _get$Eval(eval);

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.Identifier],

    condition: (node, parent) => {
        if (node.name === 'eval') {
            // Skip: eval()
            if (parent.type === Syntax.CallExpression && parent.callee === node)
                return false;

            // Skip: class X { eval () {} }
            if (parent.type === Syntax.MethodDefinition)
                return false;

            // Skip: class eval { x () {} }
            if (parent.type === Syntax.ClassDeclaration)
                return false;

            // Skip: window.eval, eval.call
            if (parent.type === Syntax.MemberExpression)
                return false;

            // Skip: function eval () { ... }
            if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration) &&
                parent.id === node)
                return false;

            // Skip: function (eval) { ... } || function func(eval) { ... } || eval => { ... }
            if ((parent.type === Syntax.FunctionExpression || parent.type === Syntax.FunctionDeclaration ||
                 parent.type === Syntax.ArrowFunctionExpression) && parent.params.indexOf(node) !== -1)
                return false;

            // Skip: { eval: value }
            if (parent.type === Syntax.Property && parent.key === node)
                return false;

            // Skip: eval = value || function x (eval = value) { ... }
            if ((parent.type === Syntax.AssignmentExpression || parent.type === Syntax.AssignmentPattern) &&
                parent.left === node)
                return false;

            // Skip: const eval = value;
            if (parent.type === Syntax.VariableDeclarator && parent.id === node)
                return false;

            // Skip: eval++ || eval-- || ++eval || --eval
            if (parent.type === Syntax.UpdateExpression && parent.operator === '++' ||
                parent.operator === '--')
                return false;

            // Skip already transformed: __get$Eval(eval)
            if (parent.type === Syntax.CallExpression && parent.callee.name === INSTRUCTION.getEval)
                return false;

            // Skip: function x (...eval) {}
            if (parent.type === Syntax.RestElement)
                return false;

            return true;
        }

        return false;
    },

    run: createGetEvalMethCall
};
