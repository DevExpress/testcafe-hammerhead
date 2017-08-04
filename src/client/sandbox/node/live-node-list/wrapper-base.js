import nativeMethods from '../../native-methods';

const DEFINED_PROPERTIES_COUNT = 10000;

export class LiveNodeListWrapperBase {
    constructor () {
        const defineProperty = function (index, isEnumerable) {
            nativeMethods.objectDefineProperty.call(window, this, index, {
                enumerable:   isEnumerable,
                configurable: true,

                get: function () {
                    this._refreshNodeList();

                    return this._filteredNodeList[index];
                }
            });
        };

        for (let i = 0; i < DEFINED_PROPERTIES_COUNT; i++)
            defineProperty.call(this, i, false);

        nativeMethods.objectDefineProperty.call(window, this, '_defineProperty', { value: defineProperty });
        nativeMethods.objectDefineProperty.call(window, this, '_refreshNodeList', {
            value: () => {
                throw new Error('Not implemented');
            }
        });
    }
}

LiveNodeListWrapperBase.prototype = NodeList.prototype;

export const nodeListWrapperBase = new LiveNodeListWrapperBase();

LiveNodeListWrapperBase.prototype = HTMLCollection.prototype;

export const htmlCollectionWrapperBase = new LiveNodeListWrapperBase();
