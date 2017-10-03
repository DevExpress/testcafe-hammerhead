import nativeMethods from '../../native-methods';
import { isShadowUIElement } from '../../../utils/dom';
import WrapperState from './wrapper-state';

export default class LiveNodeListWrapper {
    constructor (nodeList, tagName) {
        const state = new WrapperState(nodeList, tagName);

        nativeMethods.objectDefineProperties.call(window.Object, this, {
            item: {
                value: index => {
                    state.refreshNodeListIfNecessary();

                    return state.filteredNodeList[index];
                }
            },

            length: {
                get: () => {
                    state.refreshNodeListIfNecessary();

                    return state.filteredNodeList.length;
                }
            }
        });

        if (state.nodeList.namedItem) {
            nativeMethods.objectDefineProperty.call(window.Object, this, 'namedItem', {
                value: (...args) => {
                    const findNamedItem = state.nodeList.namedItem.apply(state.nodeList, args);

                    return findNamedItem && isShadowUIElement(findNamedItem) ? null : findNamedItem;
                }
            });
        }
    }
}
