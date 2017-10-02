import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';
import WrapperStateManager from './wrapper-state-manager';

export default class LiveNodeListWrapper {
    constructor (nodeList, tagName) {
        const state = new WrapperStateManager(nodeList, tagName);

        nativeMethods.objectDefineProperties.call(window.Object, this, {
            item: {
                value: index => {
                    state.refreshNodeListIfNecessary();

                    return state.filteredNodeList[index];
                }
            },

            namedItem: {
                value: state.nodeList.namedItem ? (...args) => {
                    const findNamedItem = state.nodeList.namedItem.apply(state.nodeList, args);

                    return findNamedItem && isShadowUIElement(findNamedItem) ? null : findNamedItem;
                } : void 0
            },

            length: {
                get: () => {
                    state.refreshNodeListIfNecessary();

                    return state.filteredNodeList.length;
                }
            }
        });
    }
}
