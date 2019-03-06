// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { CallExpression, MemberExpression, Expression, Literal, Identifier } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createStringLiteral, createMethCallWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentMethod } from '../instrumented';

// Transform:
// obj.method(args...); obj[method](args...); -->
// _call$(obj, 'method', args...); _call$(obj, method, args...);

const transformer: Transformer = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.CallExpression,

    condition: (node: CallExpression) => {
        const callee = node.callee;

        if (callee.type === Syntax.MemberExpression) {
            // Skip: super.meth()
            if (callee.object.type === Syntax.Super)
                return false;

            if (callee.computed)
                return callee.property.type === Syntax.Literal ? shouldInstrumentMethod(callee.property.value) : true;

            return callee.property.type === Syntax.Identifier && shouldInstrumentMethod(callee.property.name);
        }

        return false;
    },

    run: (node: CallExpression): CallExpression => {
        const callee = <MemberExpression>node.callee;
        // eslint-disable-next-line
        const method = callee.computed ? <Literal>callee.property : createStringLiteral((<Identifier>callee.property).name);

        return createMethCallWrapper(<Expression>callee.object, method, node.arguments);
    }
};

export default transformer;
