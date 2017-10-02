import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';
import WrapperStateManager from './wrapper-state-manager';

export default class LiveNodeListWrapper {
    constructor (nodeList, tagName) {
        const internalInfo = new WrapperStateManager(nodeList, tagName);

        nativeMethods.objectDefineProperties.call(window.Object, this, {
            item: {
                value: index => {
                    internalInfo.refreshNodeList();

                    return internalInfo.filteredNodeList[index];
                }
            },

            namedItem: {
                value: internalInfo.nodeList.namedItem ? (...args) => {
                    const findNamedItem = internalInfo.nodeList.namedItem.apply(internalInfo.nodeList, args);

                    return findNamedItem && isShadowUIElement(findNamedItem) ? null : findNamedItem;
                } : void 0
            },

            length: {
                get: () => {
                    internalInfo.refreshNodeList();

                    return internalInfo.filteredNodeList.length;
                }
            }
        });
    }
}
