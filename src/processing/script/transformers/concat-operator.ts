// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import {
    AssignmentExpression,
    Identifier,
    MemberExpression,
} from 'estree';

import { Transformer } from './index';
import { createExpandedConcatOperation } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// val1 += val2
// --> val1 = val1 + val2

const transformer: Transformer<AssignmentExpression> = {
    name: 'concat-operator',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.AssignmentExpression,

    condition: node => {
        if (node.operator !== '+=')
            return false;

        const left = node.left;

        // location
        if (left.type === Syntax.Identifier)
            return shouldInstrumentProperty(left.name);

        if (left.type === Syntax.MemberExpression) {
            // something['location'] or something[propname]
            if (left.computed) {
                return left.property.type === Syntax.Literal
                    ? shouldInstrumentProperty(left.property.value)
                    : left.property.type !== Syntax.UpdateExpression;
            }

            // something.location
            else if (left.property.type === Syntax.Identifier)
                return shouldInstrumentProperty(left.property.name);
        }

        return false;
    },

    run: node => createExpandedConcatOperation(node.left as Identifier | MemberExpression, node.right),
};

export default transformer;
