// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { ImportExpression } from 'estree';
import { Transformer } from './index';
import { createGetProxyUrlMethodCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';

// Transform:
// import(something).then()
// -->
// import(__get$ProxyUrl(something)).then()

const transformer: Transformer<ImportExpression> = {
    name: 'dynamic-import',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.ImportExpression,

    condition: () => true,

    run: node => {
        const newSource = createGetProxyUrlMethodCall(node.source, transformer.getBaseUrl?.());

        replaceNode(node.source, newSource, node, 'source');

        return null;
    },
};

export default transformer;
