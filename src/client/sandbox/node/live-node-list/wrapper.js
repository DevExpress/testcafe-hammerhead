import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';

const arrayFilter = Array.prototype.filter;

export default class LiveNodeListWrapper {
    constructor (nodeList, domContentLoadedEventRaised, tagName) {
        nativeMethods.objectDefineProperty.call(window.Object, this, 'item', {
            value: index => {
                this._refreshNodeList();

                return this._filteredNodeList[index];
            }
        });
        nativeMethods.objectDefineProperty.call(window.Object, this, 'length', {
            get: () => {
                this._refreshNodeList();

                return this._filteredNodeList.length;
            }
        });

        if (this.namedItem) {
            nativeMethods.objectDefineProperty.call(window.Object, this, 'namedItem', {
                value: (...args) => {
                    const findNamedItem = this._nodeList.namedItem.apply(this._nodeList, args);

                    return findNamedItem && isShadowUIElement(findNamedItem) ? null : findNamedItem;
                }
            });
        }

        nativeMethods.objectDefineProperty.call(window.Object, this, '_nodeList', { value: nodeList });
        nativeMethods.objectDefineProperty.call(window.Object, this, '_filteredNodeList', { writable: true });
        nativeMethods.objectDefineProperty.call(window.Object, this, '_isDirty', { writable: true, value: true });
        nativeMethods.objectDefineProperty.call(window.Object, this, '_domContentLoadedEventRaised', {
            writable: true,
            value:    domContentLoadedEventRaised
        });
        nativeMethods.objectDefineProperty.call(window.Object, this, '_tagName', { value: tagName.toLowerCase() });
        nativeMethods.objectDefineProperty.call(window.Object, this, '_refreshNodeListInternal', {
            value: () => {
                this._filteredNodeList = arrayFilter.call(this._nodeList, element => !isShadowUIElement(element));
            },

            configurable: true // Only for tests
        });
        nativeMethods.objectDefineProperty.call(window.Object, this, '_refreshNodeList', {
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
