// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import {
    CallExpression,
    MemberExpression,
    Expression,
} from 'estree';

import { Transformer } from './index';
import { createGetEvalMethodCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';

// Transform:
// foo = eval.bind(...); -->
// foo = __get$Eval(eval).bind(...);

const transformer: Transformer<CallExpression> = {
    name: 'eval-bind',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.CallExpression,

    condition: node => {
        if (node.callee.type === Syntax.MemberExpression && node.callee.property.type === Syntax.Identifier &&
            node.callee.property.name === 'bind') {
            const obj = node.callee.object;

            // obj.eval.bind(), obj[eval].bind()
            if (obj.type === Syntax.MemberExpression &&
                (obj.property.type === Syntax.Identifier && obj.property.name ||
                 obj.property.type === Syntax.Literal && obj.property.value) === 'eval')
                return true;

            // eval.bind()
            if (obj.type === Syntax.Identifier && obj.name === 'eval')
                return true;
        }

        return false;
    },

    run: node => {
        const callee      = node.callee as MemberExpression;
        const getEvalNode = createGetEvalMethodCall(callee.object as Expression);

        replaceNode(callee.object, getEvalNode, callee, 'object');

        return null;
    },
};

export default transformer;
