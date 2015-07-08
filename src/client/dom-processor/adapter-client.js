import { isIE9 } from '../util/browser';
import { findDocument } from '../util/dom';
import NativeMethods from '../sandboxes/native-methods';
import { EventEmitter } from '../util/service';
import DomAdapterBase from '../../processing/dom/adapter-base';
import Settings from '../settings';
import UrlUtil from '../util/url';
import Const from '../../const';

export default class ClientAdapter extends DomAdapterBase {
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
