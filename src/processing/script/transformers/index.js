// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import computedPropertyGetTransformer from './computed-property-get';
import computedPropertySetTransformer from './computed-property-set';
import concatOperatorTransformer from './concat-operator';
import evalTransformer from './eval';
import evalCallApplyTransformer from './eval-call-apply';
import evalGetTransformer from './eval-get';
import windowEvalGetTransformer from './window-eval-get';
import forInTransformer from './for-in';
import locationGetTransformer from './location-get';
import storageGetTransformer from './storage-get';
import locationPropertyGetTransformer from './location-property-get';
import locationSetTransformer from './location-set';
import propertyGetTransformer from './property-get';
import propertySetTransformer from './property-set';
import methodCallTransformer from './method-call';


const TRANSFORMERS = [
    computedPropertyGetTransformer,
    computedPropertySetTransformer,
    concatOperatorTransformer,
    evalTransformer,
    evalCallApplyTransformer,
    evalGetTransformer,
    windowEvalGetTransformer,
    forInTransformer,
    locationGetTransformer,
    storageGetTransformer,
    locationPropertyGetTransformer,
    locationSetTransformer,
    propertyGetTransformer,
    propertySetTransformer,
    methodCallTransformer
];


export default (function createTransformerMap () {
    var transformerMap = {};

    for (var i = 0; i < TRANSFORMERS.length; i++) {
        var transformer = TRANSFORMERS[i];

        for (var j = 0; j < transformer.nodeTypes.length; j++) {
            var nodeType = transformer.nodeTypes[j];

            if (!transformerMap[nodeType])
                transformerMap[nodeType] = [];

            transformerMap[nodeType].push(transformer);
        }
    }

    return transformerMap;
})();
