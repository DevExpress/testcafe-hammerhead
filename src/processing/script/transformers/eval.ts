// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { CallExpression } from 'estree';
import { Transformer } from './index';
import { createProcessScriptMethodCall } from '../node-builder';
import replaceNode from './replace-node';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// eval(script); --> eval(__proc$Script(script));

const transformer: Transformer<CallExpression> = {
    name: 'eval',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.CallExpression,

    condition: node => {
        if (!node.arguments.length)
            return false;

        const callee = node.callee;

        // eval()
        if (callee.type === Syntax.Identifier && callee.name === 'eval')
            return true;

        // obj.eval(), obj['eval'](),
        return callee.type === Syntax.MemberExpression &&
               (callee.property.type === Syntax.Identifier && callee.property.name ||
                callee.property.type === Syntax.Literal && callee.property.value) === 'eval';
    },

    run: node => {
        const newArgs = createProcessScriptMethodCall(node.arguments[0]);

        replaceNode(node.arguments[0], newArgs, node, 'arguments');

        return null;
    },
};

export default transformer;
