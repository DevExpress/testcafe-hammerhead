// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { Transformer } from './index';
import { Literal } from 'estree';
import { getProxyUrlLiteral } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// import something from 'url';   -->   import something from 'processed-url';
// export * from 'url';   -->   export * from 'processed-url';
// export { x as y } from 'url';   -->   export { x as y } from 'processed-url';

const transformer: Transformer<Literal> = {
    name: 'static-import',

    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.Literal,

    condition: (node, parent) => !!parent && (parent.type === Syntax.ImportDeclaration ||
                                              parent.type === Syntax.ExportAllDeclaration ||
                                              parent.type === Syntax.ExportNamedDeclaration) && parent.source === node,

    run: node => transformer.resolver ? getProxyUrlLiteral(node, transformer.resolver) : null,
};

export default transformer;
