// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { CallExpression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createGetProxyUrlMethodCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';

// Transform:
// import(something).then()
// -->
// import(__get$ProxyUrl(something)).then()

const transformer: Transformer<CallExpression> = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.CallExpression,

    // @ts-ignore
    condition: node => node.callee.type === Syntax.Import,

    run: node => {
        const newArgs = createGetProxyUrlMethodCall(node.arguments[0], transformer.baseUrl);

        replaceNode(node.arguments[0], newArgs, node, 'arguments');

        return null;
    }
};

export default transformer;
