// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
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
import staticImportTransformer from './static-import';
import dynamicImportTransformer from './dynamic-import';

export interface Transformer<C extends Node> {
    nodeReplacementRequireTransform: boolean;
    nodeTypes: C['type'];
    condition: (node: C, parent?: Node) => boolean;
    run: <P extends Node>(node: C, parent?: P, key?: keyof P) => Node|null;
    baseUrl?: string;
    wrapLastExpr?: boolean;
    resolver?: Function
}

const TRANSFORMERS: Array<Transformer<any>> = [
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
    jsProtocolLastExpression,
    staticImportTransformer,
    dynamicImportTransformer
];

function createTransformerMap (): Map<Transformer<Node>['nodeTypes'], Array<Transformer<Node>>> {
    const transformerMap: Map<Transformer<Node>['nodeTypes'], Array<Transformer<Node>>> = new Map();

    for (const transformer of TRANSFORMERS) {
        const nodeType   = transformer.nodeTypes;
        let transformers = transformerMap.get(nodeType);

        if (!transformers) {
            transformers = [];
            transformerMap.set(nodeType, transformers);
        }

        transformers.push(transformer);
    }

    return transformerMap;
}

export default createTransformerMap();
