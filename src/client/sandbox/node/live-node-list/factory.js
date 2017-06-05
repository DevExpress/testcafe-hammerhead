import LiveNodeListWrapper from './wrapper';
import {
    NodeListPropertiesDecorator,
    HTML_COLLECTION_PROPERTIES_DECORATOR,
    NODE_LIST_PROPERTIES_DECORATOR
} from './property-decorator';
import TagCache from './tag-cache';
import { getTagName } from '../../../utils/dom';
import nativeMethods from '../../native-methods';

var arrayForEach = Array.prototype.forEach;
var arrayFilter  = Array.prototype.filter;

export default class LiveNodeListFactory {
    constructor () {
        // NOTE: Now there is an implementation only for the 'getElementsByTagName' function
        // Later we will have separate parts for all appropriate functions (getElementsByClassName, getElementsByName)
        this.wrappersWithReqularTag      = [];
        this.wrappersWithAsteriskTag     = [];
        this.domContentLoadedEventRaised = false;
        this.tagCache                    = new TagCache();

        nativeMethods.addEventListener.call(document, 'DOMContentLoaded', () => {
            this.domContentLoadedEventRaised = true;

            LiveNodeListFactory._notifyWrappersAboutDOMContentLoadedEvent(this.wrappersWithAsteriskTag);
            LiveNodeListFactory._notifyWrappersAboutDOMContentLoadedEvent(this.wrappersWithReqularTag);
        });
    }

    static _markWrappersAsDirty (wrappers) {
        arrayForEach.call(wrappers, wrapper => {
            wrapper._isDirty = true;
        });
    }

    static _notifyWrappersAboutDOMContentLoadedEvent (wrappers) {
        arrayForEach.call(wrappers, wrapper => {
            wrapper._domContentLoadedEventRaised = true;
        });
    }

    onElementMutation (el) {
        LiveNodeListFactory._markWrappersAsDirty(this.wrappersWithAsteriskTag);

        var tagName = getTagName(el);

        if (!this.tagCache.contains(tagName))
            return;

        var wrappersWithSpecifiedTag = arrayFilter.call(this.wrappersWithReqularTag, wrapper => wrapper._tagName === tagName);

        LiveNodeListFactory._markWrappersAsDirty(wrappersWithSpecifiedTag);
    }

    _createLiveNodeListWrapper (nodeList, domContentLoadedEventRaised, tagName) {
        if (nodeList instanceof NodeList)
            LiveNodeListWrapper.prototype = NODE_LIST_PROPERTIES_DECORATOR;
        else if (nodeList instanceof HTMLCollection)
            LiveNodeListWrapper.prototype = HTML_COLLECTION_PROPERTIES_DECORATOR;
        else {
            // NOTE: For iframe's collections
            NodeListPropertiesDecorator.prototype = nodeList;
            LiveNodeListWrapper.prototype         = new NodeListPropertiesDecorator();
        }

        return new LiveNodeListWrapper(nodeList, domContentLoadedEventRaised, tagName);
    }

    createNodeListForGetElementsByTagNameFn ({ nodeList, tagName }) {
        if (typeof tagName !== 'string')
            return nodeList;

        this.tagCache.update(tagName);

        var wrapper = this._createLiveNodeListWrapper(nodeList, this.domContentLoadedEventRaised, tagName);

        if (tagName === '*')
            this.wrappersWithAsteriskTag.push(wrapper);
        else
            this.wrappersWithReqularTag.push(wrapper);

        return wrapper;
    }

    onInnerHtmlChanged () {
        LiveNodeListFactory._markWrappersAsDirty(this.wrappersWithAsteriskTag);
        LiveNodeListFactory._markWrappersAsDirty(this.wrappersWithReqularTag);
    }
}
