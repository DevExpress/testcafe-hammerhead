// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { ExpressionStatement, Program } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createHtmlProcessorWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';

// Transform:
// x = 5; "hello" --> x = 5; parent.__proc$Html(window, "hello")
// someAction(); generateHtmlPage() --> someAction(); parent.__proc$Html(window, generateHtmlPage())

export interface ModifiedProgram extends Program {
    wrapLastExprWithProcessHtml?: boolean;
}

const transformer: Transformer = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.ExpressionStatement,

    condition: (node: ExpressionStatement, parent: ModifiedProgram) => parent.wrapLastExprWithProcessHtml && parent.body[parent.body.length - 1] === node,

    run: (node: ExpressionStatement, parent: ModifiedProgram) => {
        parent.wrapLastExprWithProcessHtml = false;

        return createHtmlProcessorWrapper(node);
    }
};

export default transformer;
