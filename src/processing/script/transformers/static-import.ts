// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { Transformer } from './index';
import { Literal } from 'estree';
/*eslint-enable no-unused-vars*/
import { getProxyUrlLiteral } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// import something from 'url';
// -->
// import something from 'processed-url';

const transformer: Transformer<Literal> = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.Literal,

    condition: (node, parent) => !!parent && parent.type === Syntax.ImportDeclaration && parent.source === node,

    run: node => transformer.resolver ? getProxyUrlLiteral(node, transformer.resolver) : null
};

export default transformer;
