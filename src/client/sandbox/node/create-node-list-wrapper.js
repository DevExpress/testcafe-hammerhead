import { isShadowUIElement } from '../../utils/dom';

const DEFINED_PROPERTIES_COUNT = 10000;

const arrayFilter = Array.prototype.filter;

class PropertiesDecorator {
    constructor () {
        var defineProperty = function (index, isEnumerable) {
            Object.defineProperty(this, index, {
                enumerable:   isEnumerable,
                configurable: true,
                get:          function () {
                    if (this._isLiveCollection)
                        this._refreshNodeList();

                    return this._filteredNodeList[index];
                }
            });
        };

        for (var i = 0; i < DEFINED_PROPERTIES_COUNT; i++)
            defineProperty.call(this, i, false);

        Object.defineProperty(this, '_defineProperty', { value: defineProperty });
    }
}

class NodeListWrapper {
    constructor (nodeList, isLiveCollection) {
        Object.defineProperty(this, 'item', {
            enumerable: true,
            value:      index => this._filteredNodeList[index]
        });

        Object.defineProperty(this, 'length', {
            enumerable: true,
            get:        () => {
                if (isLiveCollection)
                    this._refreshNodeList();

                return this._filteredNodeList.length;
            }
        });

        Object.defineProperty(this, '_isLiveCollection', { value: isLiveCollection });
        Object.defineProperty(this, '_nodeList', { value: nodeList });
        Object.defineProperty(this, '_filteredNodeList', { writable: true });

        if (this.namedItem) {
            Object.defineProperty(this, 'namedItem', {
                enumerable: true,
                value:      (...args) => this._nodeList.namedItem.apply(this._nodeList, args)
            });
        }

        Object.defineProperty(this, '_refreshNodeList', {
            value: () => {
                this._filteredNodeList = arrayFilter.call(this._nodeList, element => !isShadowUIElement(element));
            }
        });

        this._refreshNodeList();

        for (var i = 0; i < this._filteredNodeList.length; i++)
            this._defineProperty(i, true);
    }
}

PropertiesDecorator.prototype = NodeList.prototype;

const NODE_LIST_PROPERTIES_DECORATOR = new PropertiesDecorator();

PropertiesDecorator.prototype = HTMLCollection.prototype;

const HTML_COLLECTION_PROPERTIES_DECORATOR = new PropertiesDecorator();

export default function createNodeListWrapper ({ nodeList, isLiveCollection }) {
    if (nodeList instanceof NodeList)
        NodeListWrapper.prototype = NODE_LIST_PROPERTIES_DECORATOR;
    else if (nodeList instanceof HTMLCollection)
        NodeListWrapper.prototype = HTML_COLLECTION_PROPERTIES_DECORATOR;
    else {
        // NOTE: For iframe's collections
        PropertiesDecorator.prototype = nodeList;
        NodeListWrapper.prototype     = new PropertiesDecorator();
    }

    return new NodeListWrapper(nodeList, isLiveCollection);
}
