// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
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
const TRANSFORMERS = [
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
export default (function createTransformerMap() {
    const transformerMap = {};
    for (let i = 0; i < TRANSFORMERS.length; i++) {
        const transformer = TRANSFORMERS[i];
        for (let j = 0; j < transformer.nodeTypes.length; j++) {
            const nodeType = transformer.nodeTypes[j];
            if (!transformerMap[nodeType])
                transformerMap[nodeType] = [];
            transformerMap[nodeType].push(transformer);
        }
    }
    return transformerMap;
})();
