// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { AssignmentExpression, Identifier, MemberExpression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createExpandedConcatOperation } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// val1 += val2
// --> val1 = val1 + val2

const transformer: Transformer = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.AssignmentExpression,

    condition: (node: AssignmentExpression): boolean => node.operator === '+=',

    run: (node: AssignmentExpression): AssignmentExpression => createExpandedConcatOperation(<Identifier | MemberExpression>node.left, node.right)
};

export default transformer;
