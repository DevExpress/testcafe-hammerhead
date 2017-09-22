import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';
import WrapperInternalInfo from './wrapper-internal-info';

export default class LiveNodeListWrapper {
    constructor (nodeList, type, data) {
        const internalInfo = new WrapperInternalInfo(nodeList, type, data);

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
