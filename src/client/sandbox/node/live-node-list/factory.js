import { LiveNodeListWrapperBase, htmlCollectionWrapperBase, nodeListWrapperBase } from './wrapper-base';
import LiveNodeListWrapper from './wrapper';
import { TAG_TYPE/*, CLASS_TYPE, NAME_TYPE*/ } from './wrapper-internal-info';

export default class LiveNodeListFactory {
    static _createLiveNodeListWrapper (nodeList, type, data) {
        if (nodeList instanceof NodeList)
            LiveNodeListWrapper.prototype = nodeListWrapperBase;
        else if (nodeList instanceof HTMLCollection)
            LiveNodeListWrapper.prototype = htmlCollectionWrapperBase;
        else {
            // NOTE: For iframe's collections
            LiveNodeListWrapperBase.prototype = nodeList;
            LiveNodeListWrapper.prototype     = new LiveNodeListWrapperBase();
        }

        return new LiveNodeListWrapper(nodeList, type, data);
    }

    static createNodeListForGetElementsByTagNameFn ({ nodeList, tagName }) {
        if (typeof tagName !== 'string')
            return nodeList;

        const wrapper = LiveNodeListFactory._createLiveNodeListWrapper(nodeList, TAG_TYPE, tagName);

        return wrapper;
    }
}
