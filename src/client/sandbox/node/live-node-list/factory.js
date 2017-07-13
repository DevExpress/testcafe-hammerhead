import {
    LiveNodeListWrapperBase,
    htmlCollectionWrapperBase,
    nodeListWrapperBase
} from './wrapper-base';
import LiveNodeListWrapper from './wrapper';
import { getTagName, isShadowUIElement } from '../../../utils/dom';
import nativeMethods from '../../native-methods';
import WrapperStorage from './wrapper-storage';

export default class LiveNodeListFactory {
    constructor () {
        // NOTE: Now there is an implementation only for the 'getElementsByTagName' function
        // Later we will have separate parts for all appropriate functions (getElementsByClassName, getElementsByName)
        this.domContentLoadedEventRaised = false;
        this.wrapperStorage              = new WrapperStorage();

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this.domContentLoadedEventRaised = true;
            this.wrapperStorage.notifyAllWrappersAboutDOMContentLoadedEvent();
        });
    }

    onElementAddedOrRemoved (el) {
        if (!el.tagName || isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        this.wrapperStorage.markWrappersWithSpecifiedTagNameAsDirty(tagName);
    }

    _createLiveNodeListWrapper (nodeList, domContentLoadedEventRaised, tagName) {
        if (nodeList instanceof NodeList)
            LiveNodeListWrapper.prototype = nodeListWrapperBase;
        else if (nodeList instanceof HTMLCollection)
            LiveNodeListWrapper.prototype = htmlCollectionWrapperBase;
        else {
            // NOTE: For iframe's collections
            LiveNodeListWrapperBase.prototype = nodeList;
            LiveNodeListWrapper.prototype     = new LiveNodeListWrapperBase();
        }

        return new LiveNodeListWrapper(nodeList, domContentLoadedEventRaised, tagName);
    }

    createNodeListForGetElementsByTagNameFn ({ nodeList, tagName }) {
        if (typeof tagName !== 'string')
            return nodeList;

        const wrapper = this._createLiveNodeListWrapper(nodeList, this.domContentLoadedEventRaised, tagName);

        this.wrapperStorage.add(wrapper);

        return wrapper;
    }

    onInnerHtmlChanged () {
        this.wrapperStorage.markAllWrappersAsDirty();
    }
}
