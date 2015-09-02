import { isIE9 } from '../utils/browser';
import { findDocument } from '../utils/dom';
import NativeMethods from '../sandbox/native-methods';
import EventEmitter from '../utils/event-emitter';
import BaseDomAdapter from '../../processing/dom/base-dom-adapter';
import Settings from '../settings';
import UrlUtil from '../utils/url';
import Const from '../../const';

export default class ClientDomAdapter extends BaseDomAdapter {
    getAttr (el, attr) {
        return NativeMethods.getAttribute.call(el, attr);
    }

    hasAttr (el, attr) {
        for (var i = 0; i < el.attributes.length; i++) {
            if (el.attributes[i].name === attr)
                return true;
        }

        return false;
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
        return NativeMethods.setAttribute.call(el, attr, value);
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
            var clone = NativeMethods.cloneNode.call(el, false);

            clone.src = clone.innerHTML = '';

            return clone;
        }

        return el;
    }

    needToProcessUrl () {
        return true;
    }

    hasIFrameParent (el) {
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
        return Settings.get().CROSS_DOMAIN_PROXY_PORT;
    }

    getProxyUrl () {
        return UrlUtil.getProxyUrl.apply(UrlUtil, arguments);
    }

    isTopParentIFrame (el) {
        var elWindow = el[Const.DOM_SANDBOX_PROCESSED_CONTEXT];

        return elWindow && window.top === elWindow.parent;
    }
}
