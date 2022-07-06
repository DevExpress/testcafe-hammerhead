// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { Node } from 'estree';
import TempVariables from './temp-variables';
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
import forOfTransformer from './for-of';
import locationGetTransformer from './location-get';
import locationSetTransformer from './location-set';
import propertyGetTransformer from './property-get';
import propertySetTransformer from './property-set';
import methodCallTransformer from './method-call';
import jsProtocolLastExpression from './js-protocol-last-expression';
import staticImportTransformer from './static-import';
import dynamicImportTransformer from './dynamic-import';
import declarationDestructuring from './declaration-destructuring';
import assignmentDestructuring from './assignment-destructuring';
import createFuncArgsDestructing from './func-args-destructing';
import { Syntax } from 'esotope-hammerhead';

export interface Transformer<C extends Node> {
    name: string;
    nodeReplacementRequireTransform: boolean;
    nodeTypes: C['type'];
    condition: (node: C, parent?: Node) => boolean;
    run: <P extends Node>(node: C, parent?: P, key?: keyof P, tempVars?: TempVariables) => Node|null;
    getBaseUrl?: () => string;
    baseUrl?: string;
    wrapLastExpr?: boolean;
    resolver?: Function;
}

const TRANSFORMERS: Transformer<any>[] = [
    createFuncArgsDestructing(Syntax.FunctionDeclaration),
    createFuncArgsDestructing(Syntax.FunctionExpression),
    createFuncArgsDestructing(Syntax.ArrowFunctionExpression),
    assignmentDestructuring,
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
    forOfTransformer,
    locationGetTransformer,
    locationSetTransformer,
    propertyGetTransformer,
    propertySetTransformer,
    methodCallTransformer,
    jsProtocolLastExpression,
    staticImportTransformer,
    dynamicImportTransformer,
    declarationDestructuring,
];

function createTransformerMap (): Map<Transformer<Node>['nodeTypes'], Transformer<Node>[]> {
    const transformerMap: Map<Transformer<Node>['nodeTypes'], Transformer<Node>[]> = new Map();

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
