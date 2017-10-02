import { LiveNodeListWrapperBase, htmlCollectionWrapperBase, nodeListWrapperBase } from './wrapper-base';
import LiveNodeListWrapper from './wrapper';

export default class LiveNodeListFactory {
    static _createLiveNodeListWrapper (nodeList, tagName) {
        if (nodeList instanceof NodeList)
            LiveNodeListWrapper.prototype = nodeListWrapperBase;
        else if (nodeList instanceof HTMLCollection)
            LiveNodeListWrapper.prototype = htmlCollectionWrapperBase;
        else {
            // NOTE: For iframe's collections
            LiveNodeListWrapperBase.prototype = nodeList;
            LiveNodeListWrapper.prototype     = new LiveNodeListWrapperBase();
        }

        return new LiveNodeListWrapper(nodeList, tagName);
    }

    static createNodeListForGetElementsByTagNameFn ({ nodeList, tagName }) {
        if (typeof tagName !== 'string')
            return nodeList;

        return LiveNodeListFactory._createLiveNodeListWrapper(nodeList, tagName.toLowerCase());
    }
}
