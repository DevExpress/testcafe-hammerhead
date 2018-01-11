import nativeMethods from '../../native-methods';

const DEFINED_PROPERTIES_COUNT = 10000;

export class LiveNodeListWrapperBase {
    constructor () {
        for (let i = 0; i < DEFINED_PROPERTIES_COUNT; i++) {
            nativeMethods.objectDefineProperty.call(window.Object, this, i, {
                enumerable:   false,
                configurable: true,
                get:          function () {
                    return this.item(i);
                }
            });
        }
    }
}

LiveNodeListWrapperBase.prototype = NodeList.prototype;

export let nodeListWrapperBase = new LiveNodeListWrapperBase();

LiveNodeListWrapperBase.prototype = HTMLCollection.prototype;

export let htmlCollectionWrapperBase = new LiveNodeListWrapperBase();

export function dispose () {
    nodeListWrapperBase       = null;
    htmlCollectionWrapperBase = null;
}
