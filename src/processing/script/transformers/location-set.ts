// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { AssignmentExpression, Node, Expression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createLocationSetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// location = value -->
// (function(){ return __set$Loc(location, value) || location = value;}.apply(this))

const transformer: Transformer = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.AssignmentExpression,

    condition: (node: AssignmentExpression) => node.operator === '=' &&
                                               node.left.type === Syntax.Identifier && node.left.name === 'location',

    run: (node: AssignmentExpression, parent: Node, key: string): Expression => {
        const wrapWithSequence = key !== 'arguments' && key !== 'consequent' && key !== 'alternate' &&
                                 (parent.type !== Syntax.SequenceExpression || parent.expressions[0] === node);

        return createLocationSetWrapper(node.right, wrapWithSequence);
    }
};

export default transformer;
