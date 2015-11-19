// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createGetEvalMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';

// Transform:
// var foo = eval; foo = eval; { _eval: eval }; return eval;
// -->
// var foo = _get$Eval(eval); foo = _get$Eval(eval); { _eval: _get$Eval(eval) }; return _get$Eval(eval);

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.Identifier, Syntax.MemberExpression],

    condition: (node, parentNode) => {
        if (node.type === Syntax.Identifier && node.name === 'eval') {
            // eval()
            if (parentNode.type === Syntax.CallExpression && parentNode.callee === node)
                return false;

            // window.eval, eval.call
            if (parentNode.type === Syntax.MemberExpression)
                return false;

            // function(eval) {}
            if (parentNode.type === Syntax.FunctionExpression)
                return false;

            return true;
        }

        if (node.type === Syntax.MemberExpression) {
            // window.eval.field
            if (parentNode.type === Syntax.MemberExpression &&
                (parentNode.property === node || parentNode.object === node))
                return false;

            // window.eval()
            if (parentNode.type === Syntax.CallExpression && parentNode.callee === node)
                return false;

            // window.eval
            if (node.property.type === Syntax.Identifier && node.property.name === 'eval')
                return true;

            // window['eval']
            if (node.property.type === Syntax.Literal && node.property.value === 'eval')
                return true;
        }

        return false;
    },

    run: createGetEvalMethCall
};
