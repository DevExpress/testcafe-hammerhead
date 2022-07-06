// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { ExpressionStatement } from 'estree';
import { Transformer } from './index';
import { createHtmlProcessorWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// x = 5; "hello" --> x = 5; parent.__proc$Html(window, "hello")
// someAction(); generateHtmlPage() --> someAction(); parent.__proc$Html(window, generateHtmlPage())

const transformer: Transformer<ExpressionStatement> = {
    name: 'js-protocol-last-expression',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.ExpressionStatement,

    condition: (node, parent) => !!transformer.wrapLastExpr && !!parent && parent.type === Syntax.Program &&
                                 parent.body[parent.body.length - 1] === node,

    run: node => {
        transformer.wrapLastExpr = false;

        return createHtmlProcessorWrapper(node);
    },
};

export default transformer;
