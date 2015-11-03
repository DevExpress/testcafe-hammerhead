import BaseDomAdapter from './base-dom-adapter';
import events from 'events';
import * as urlUtils from '../../utils/url';
import * as parse5Utils from '../../utils/parse5';

export default class Parse5DomAdapter extends BaseDomAdapter {
    constructor (isIframe, crossDomainPort) {
        super();

        this.isIframe        = isIframe;
        this.crossDomainPort = crossDomainPort;
    }

    removeAttr (el, attr) {
        for (var i = 0; i < el.attrs.length; i++) {
            if (el.attrs[i].name === attr) {
                el.attrs.splice(i, 1);

                return;
            }
        }
    }

    getAttr (el, attr) {
        for (var i = 0; i < el.attrs.length; i++) {
            if (el.attrs[i].name === attr)
                return el.attrs[i].value;
        }

        return null;
    }

    getClassName (el) {
        return this.getAttr(el, 'class') || '';
    }

    hasAttr (el, attr) {
        return this.getAttr(el, attr) !== null;
    }

    hasEventHandler (el) {
        for (var i = 0; i < el.attrs.length; i++) {
            if (this.EVENTS.indexOf(el.attrs[i].name))
                return true;
        }

        return false;
    }

    getTagName (el) {
        return el.tagName || '';
    }

    setAttr (el, attr, value) {
        for (var i = 0; i < el.attrs.length; i++) {
            if (el.attrs[i].name === attr) {
                el.attrs[i].value = value;

                return value;
            }
        }

        el.attrs.push({ name: attr, value: value });

        return value;
    }

    setScriptContent (script, content) {
        script.childNodes = [parse5Utils.createTextNode(content, script)];
    }

    getScriptContent (script) {
        return script.childNodes.length ? script.childNodes[0].value : '';
    }

    getStyleContent (style) {
        return style.childNodes.length ? style.childNodes[0].value : '';
    }

    setStyleContent (style, content) {
        style.childNodes = [parse5Utils.createTextNode(content, style)];
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

    hasIframeParent () {
        return this.isIframe;
    }

    getCrossDomainPort () {
        return this.crossDomainPort;
    }

    getProxyUrl () {
        return urlUtils.getProxyUrl.apply(urlUtils, arguments);
    }

    isTopParentIframe () {
        return false;
    }

    sameOriginCheck (location, checkedUrl) {
        return urlUtils.sameOriginCheck(location, checkedUrl);
    }
}
