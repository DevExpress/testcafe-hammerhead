// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { AssignmentExpression, Identifier } from 'estree';
import { Transformer } from './index';
import { createLocationSetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// location = value -->
// (function(){ return __set$Loc(location, value) || location = value;}.apply(this))

const transformer: Transformer<AssignmentExpression> = {
    name: 'location-set',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.AssignmentExpression,

    condition: node => node.operator === '=' && node.left.type === Syntax.Identifier && node.left.name === 'location',

    run: (node, parent, key) => {
        if (!parent)
            return null;

        const wrapWithSequence = key !== 'arguments' && key !== 'consequent' && key !== 'alternate' &&
                                 // @ts-ignore
                                 (parent.type !== Syntax.SequenceExpression || parent.expressions[0] === node);

        return createLocationSetWrapper(node.left as Identifier, node.right, wrapWithSequence);
    },
};

export default transformer;
