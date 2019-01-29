// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createHtmlProcessorWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// x = 5; "hello" --> x = 5; parent.__proc$Html(window, "hello")
// someAction(); generateHtmlPage() --> someAction(); parent.__proc$Html(window, generateHtmlPage())

export default {
    nodeReplacementRequireTransform: true,

    nodeTypes: [Syntax.ExpressionStatement],

    condition: (node: HTMLElement, parent) => parent.wrapLastExprWithProcessHtml && parent.body[parent.body.length - 1] === node,

    run: (node, parent) => {
        parent.wrapLastExprWithProcessHtml = false;

        return createHtmlProcessorWrapper(node);
    }
};
