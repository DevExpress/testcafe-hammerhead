// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { CallExpression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createGetProxyUrlMethCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';

// Transform:
// import(something).than()
// -->
// import(__get$ProxyUrl(something)).than()

const transformer: Transformer = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.CallExpression,

    // @ts-ignore
    condition: (node: CallExpression) => node.callee.type === Syntax.Import,

    run: (node: CallExpression) => {
        const newArgs = createGetProxyUrlMethCall(node.arguments[0], transformer.baseUrl);

        replaceNode(node.arguments[0], newArgs, node, 'arguments');

        return null;
    }
};

export default transformer;
