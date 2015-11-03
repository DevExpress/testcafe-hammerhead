import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import EventEmitter from '../utils/event-emitter';
import BaseDomAdapter from '../../processing/dom/base-dom-adapter';
import nativeMethods from '../sandbox/native-methods';
import settings from '../settings';
import { sameOriginCheck } from '../utils/destination-location';
import { getProxyUrl } from '../utils/url';
import { isIE9 } from '../utils/browser';
import { findDocument } from '../utils/dom';

export default class ClientDomAdapter extends BaseDomAdapter {
    removeAttr (el, attr) {
        return el.removeAttribute(attr);
    }

    getAttr (el, attr) {
        return nativeMethods.getAttribute.call(el, attr);
    }

    hasAttr (el, attr) {
        for (var i = 0; i < el.attributes.length; i++) {
            if (el.attributes[i].name === attr)
                return true;
        }

        return false;
    }

    getClassName (el) {
        return el.className;
    }

    hasEventHandler (el) {
        var attrs = el.attributes;

        for (var i = 0; i < attrs.length; i++) {
            if (this.EVENTS.indexOf(attrs[i]))
                return true;
        }

        return false;
    }

    getTagName (el) {
        return el.tagName;
    }

    setAttr (el, attr, value) {
        return nativeMethods.setAttribute.call(el, attr, value);
    }

    setScriptContent (script, content) {
        script.text = content;
    }

    getScriptContent (script) {
        return script.text;
    }

    getStyleContent (style) {
        return style.innerHTML;
    }

    setStyleContent (style, content) {
        style.innerHTML = content;
    }

    getElementForSelectorCheck (el) {
        if (isIE9 && el.tagName.toLowerCase() === 'script') {
            var clone = nativeMethods.cloneNode.call(el, false);

            clone.src = clone.innerHTML = '';

            return clone;
        }

        return el;
    }

    needToProcessUrl () {
        return true;
    }

    hasIframeParent (el) {
        try {
            return window.top.document !== findDocument(el);
        }
        catch (e) {
            return true;
        }
    }

    attachEventEmitter (domProcessor) {
        var eventEmitter = new EventEmitter();

        domProcessor.on   = eventEmitter.on.bind(eventEmitter);
        domProcessor.off  = eventEmitter.off.bind(eventEmitter);
        domProcessor.emit = eventEmitter.emit.bind(eventEmitter);
    }

    getCrossDomainPort () {
        return settings.get().crossDomainProxyPort;
    }

    getProxyUrl () {
        return getProxyUrl.apply(null, arguments);
    }

    isTopParentIframe (el) {
        var elWindow = el[INTERNAL_PROPS.processedContext];

        return elWindow && window.top === elWindow.parent;
    }

    sameOriginCheck (location, checkedUrl) {
        return sameOriginCheck(location, checkedUrl);
    }
}
