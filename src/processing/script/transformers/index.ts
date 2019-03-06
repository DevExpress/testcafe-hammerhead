// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { Syntax } from 'esotope-hammerhead';
import { Node } from 'estree';
/*eslint-enable no-unused-vars*/
import computedPropertyGetTransformer from './computed-property-get';
import computedPropertySetTransformer from './computed-property-set';
import concatOperatorTransformer from './concat-operator';
import evalTransformer from './eval';
import evalBindTransformer from './eval-bind';
import evalCallApplyTransformer from './eval-call-apply';
import evalGetTransformer from './eval-get';
import windowEvalGetTransformer from './window-eval-get';
import postMessageGetTransformer from './post-message-get';
import windowPostMessageGetTransformer from './window-post-message-get';
import postMessageCallApplyTransformer from './post-message-call-apply-bind';
import forInTransformer from './for-in';
import locationGetTransformer from './location-get';
import locationPropertyGetTransformer from './location-property-get';
import locationSetTransformer from './location-set';
import propertyGetTransformer from './property-get';
import propertySetTransformer from './property-set';
import methodCallTransformer from './method-call';
import jsProtocolLastExpression from './js-protocol-last-expression';

export interface Transformer {
    nodeReplacementRequireTransform: boolean;
    nodeTypes: Syntax;
    condition: (node: Node, parent?: Node) => boolean;
    run: (node: Node, parent?: Node, key?: string) => Node;
}

const TRANSFORMERS: Array<Transformer> = [
    computedPropertyGetTransformer,
    computedPropertySetTransformer,
    concatOperatorTransformer,
    evalTransformer,
    evalBindTransformer,
    evalCallApplyTransformer,
    evalGetTransformer,
    windowEvalGetTransformer,
    postMessageGetTransformer,
    windowPostMessageGetTransformer,
    postMessageCallApplyTransformer,
    forInTransformer,
    locationGetTransformer,
    locationPropertyGetTransformer,
    locationSetTransformer,
    propertyGetTransformer,
    propertySetTransformer,
    methodCallTransformer,
    jsProtocolLastExpression
];

function createTransformerMap (): Map<Syntax, Array<Transformer>> {
    const transformerMap: Map<Syntax, Array<Transformer>> = new Map();

    for (const transformer of TRANSFORMERS) {
        const nodeType = transformer.nodeTypes;

        if (!transformerMap.has(nodeType))
            transformerMap.set(nodeType, []);

        transformerMap.get(nodeType).push(transformer);
    }

    return transformerMap;
}

export default createTransformerMap();
