import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';

const arrayFilter = Array.prototype.filter;

export default class LiveNodeListWrapper {
    constructor (nodeList, domContentLoadedEventRaised, tagName) {
        nativeMethods.objectDefineProperty.call(window, this, 'item', {
            value: index => {
                this._refreshNodeList();

                return this._filteredNodeList[index];
            }
        });
        nativeMethods.objectDefineProperty.call(window, this, 'length', {
            get: () => {
                this._refreshNodeList();

                return this._filteredNodeList.length;
            }
        });

        if (this.namedItem) {
            nativeMethods.objectDefineProperty.call(window, this, 'namedItem', {
                value: (...args) => {
                    const findNamedItem = this._nodeList.namedItem.apply(this._nodeList, args);

                    return findNamedItem && isShadowUIElement(findNamedItem) ? null : findNamedItem;
                }
            });
        }

        nativeMethods.objectDefineProperty.call(window, this, '_nodeList', { value: nodeList });
        nativeMethods.objectDefineProperty.call(window, this, '_filteredNodeList', { writable: true });
        nativeMethods.objectDefineProperty.call(window, this, '_isDirty', { writable: true, value: true });
        nativeMethods.objectDefineProperty.call(window, this, '_domContentLoadedEventRaised', {
            writable: true,
            value:    domContentLoadedEventRaised
        });
        nativeMethods.objectDefineProperty.call(window, this, '_tagName', { value: tagName.toLowerCase() });
        nativeMethods.objectDefineProperty.call(window, this, '_refreshNodeListInternal', {
            value: () => {
                this._filteredNodeList = arrayFilter.call(this._nodeList, element => !isShadowUIElement(element));
            },

            configurable: true // Only for tests
        });
        nativeMethods.objectDefineProperty.call(window, this, '_refreshNodeList', {
            value: () => {
                if (!this._domContentLoadedEventRaised)
                    this._refreshNodeListInternal();
                else if (this._isDirty) {
                    this._refreshNodeListInternal();
                    this._isDirty = false;
                }
            }
        });

        this._refreshNodeList();

        for (let i = 0; i < this._filteredNodeList.length; i++)
            this._defineProperty(i, true);
    }
}
