// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import INSTRUCTION from '../instruction';
import { createGetEvalMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';
// Transform:
// const foo = window.eval; foo = window.eval; { _eval: window.eval }; return window.eval;
// -->
// const foo = _get$Eval(window.eval); foo = _get$Eval(window.eval); { _eval: _get$Eval(window.eval) }; return _get$Eval(window.eval);
export default {
    nodeReplacementRequireTransform: false,
    nodeTypes: [Syntax.MemberExpression],
    condition: (node, parent) => {
        // Skip: window.eval.field
        if (parent.type === Syntax.MemberExpression && (parent.property === node || parent.object === node))
            return false;
        // Skip: window.eval()
        if (parent.type === Syntax.CallExpression && parent.callee === node)
            return false;
        // Skip: window.eval = 1, window["eval"] = 1
        if (parent.type === Syntax.AssignmentExpression && parent.left === node)
            return false;
        // Skip already transformed: __get$Eval(window.eval), __get$Eval(window["eval"])
        if (parent.type === Syntax.CallExpression && parent.callee.name === INSTRUCTION.getEval)
            return false;
        // window.eval
        if (node.property.type === Syntax.Identifier && node.property.name === 'eval')
            return true;
        // window['eval']
        if (node.property.type === Syntax.Literal && node.property.value === 'eval')
            return true;
        return false;
    },
    run: createGetEvalMethCall
};
