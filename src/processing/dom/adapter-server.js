import DomAdapterBase from './adapter-base';
import events from 'events';
import urlUtils from '../../utils/url.js';

export default class ServerAdapter extends DomAdapterBase {
    constructor (isIframe, crossDomainPort) {
        super();

        this.isIframe        = isIframe;
        this.crossDomainPort = crossDomainPort;
    }

    getAttr (el, attr) {
        return el.attribs[attr];
    }

    hasAttr (el, attr) {
        return attr in el.attribs;
    }

    hasEventHandler (el) {
        for (var attr in el.attribs) {
            if (this.EVENTS.indexOf(el.attribs[attr]))
                return true;
        }

        return false;
    }

    getTagName (el) {
        return el.name;
    }

    setAttr (el, attr, value) {
        var result = el.attribs[attr] = value;

        return result;
    }

    setScriptContent (script, content) {
        script.children[0].data = content;
    }

    getScriptContent (script) {
        // The $script.html() method is not used because it is not working properly, it adds garbage in the result.
        var contentChild = script.children.length ? script.children[0] : null;

        return contentChild ? contentChild.data : '';
    }

    getStyleContent (style) {
        // The $el.html() method is not used because it is not working properly, it adds garbage in the result.
        var contentChild = style.children.length ? style.children[0] : null;

        return contentChild && contentChild.data ? contentChild.data : null;
    }

    setStyleContent (style, content) {
        var contentChild = style.children.length ? style.children[0] : null;

        if (contentChild && contentChild.data)
            contentChild.data = content;
    }

    getElementForSelectorCheck (el) {
        return el;
    }

    needToProcessUrl (tagName, target) {
        if (this.IFRAME_FLAG_TAGS.indexOf(tagName) !== -1 && target === '_parent')
            return false;

        return true;
    }

    attachEventEmitter (domProcessor) {
        var eventEmitter = new events.EventEmitter();

        domProcessor.on   = eventEmitter.on.bind(eventEmitter);
        domProcessor.off  = eventEmitter.removeListener.bind(eventEmitter);
        domProcessor.emit = eventEmitter.emit.bind(eventEmitter);
    }

    hasIFrameParent () {
        return this.isIframe;
    }

    getCrossDomainPort () {
        return this.crossDomainPort;
    }

    getProxyUrl () {
        return urlUtils.getProxyUrl.apply(urlUtils, arguments);
    }

    isTopParentIFrame () {
        return false;
    }
}
