// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createHtmlProcessorWrapper } from '../node-builder';
import { Syntax } from '../tools/esotope';

// Transform:
// x = 5; "hello" --> x = 5; __proc$Html("hello")
// someAction(); generateHtmlPage() --> someAction(); __proc$Html(generateHtmlPage())

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.ExpressionStatement],

    condition: (node, parent) => parent.wrapLastExprViaProcessHtml && parent.body[parent.body.length - 1] === node,

    run: node => createHtmlProcessorWrapper(node)
};
