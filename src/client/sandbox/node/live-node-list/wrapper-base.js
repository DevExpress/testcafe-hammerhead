const DEFINED_PROPERTIES_COUNT = 10000;

export class LiveNodeListWrapperBase {
    constructor () {
        const defineProperty = function (index, isEnumerable) {
            Object.defineProperty(this, index, {
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

        Object.defineProperty(this, '_defineProperty', { value: defineProperty });
        Object.defineProperty(this, '_refreshNodeList', {
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
