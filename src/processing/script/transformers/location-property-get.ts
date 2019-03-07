// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { Node, MemberExpression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createLocationGetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';

// Transform:
// location.field; location[field] -->
// __get$Loc(location).field; __get$Loc(location)[field];

const transformer: Transformer = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.MemberExpression,

    condition: (node: MemberExpression, parent: Node): boolean => {
        // Skip: for(location.field in obj)
        if (parent.type === Syntax.ForInStatement && parent.left === node)
            return false;

        return node.object.type === Syntax.Identifier && node.object.name === 'location';
    },

    run: (node: MemberExpression) => {
        replaceNode(node.object, createLocationGetWrapper(), node, 'object');

        return null;
    }
};

export default transformer;
