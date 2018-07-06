import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import EventEmitter from '../utils/event-emitter';
import BaseDomAdapter from '../../processing/dom/base-dom-adapter';
import nativeMethods from '../sandbox/native-methods';
import settings from '../settings';
import { sameOriginCheck } from '../utils/destination-location';
import { getProxyUrl } from '../utils/url';
import * as domUtils from '../utils/dom';
import fastApply from '../utils/fast-apply';
import { hasUnclosedElementFlag } from '../sandbox/node/document/writer';
import { findByName } from '../sandbox/windows-storage';

export default class ClientDomAdapter extends BaseDomAdapter {
    removeAttr (el, attr) {
        return nativeMethods.removeAttribute.call(el, attr);
    }

    getAttr (el, attr) {
        return nativeMethods.getAttribute.call(el, attr);
    }

    hasAttr (el, attr) {
        return el.hasAttribute(attr);
    }

    isSVGElement (el) {
        return domUtils.isSVGElement(el);
    }

    getClassName (el) {
        return el.className;
    }

    hasEventHandler (el) {
        const attributes = nativeMethods.elementAttributesGetter.call(el);

        for (const attr of attributes) {
            if (this.EVENTS.indexOf(attr.name) !== -1)
                return true;
        }

        return false;
    }

    getTagName (el) {
        return domUtils.getTagName(el);
    }

    setAttr (el, attr, value) {
        return nativeMethods.setAttribute.call(el, attr, value);
    }

    setScriptContent (script, content) {
        nativeMethods.scriptTextSetter.call(script, content);
    }

    getScriptContent (script) {
        return nativeMethods.scriptTextGetter.call(script);
    }

    getStyleContent (style) {
        return nativeMethods.elementInnerHTMLGetter.call(style);
    }

    setStyleContent (style, content) {
        nativeMethods.elementInnerHTMLSetter.call(style, content);
    }

    needToProcessContent (el) {
        return !hasUnclosedElementFlag(el);
    }

    needToProcessUrl () {
        return true;
    }

    hasIframeParent (el) {
        try {
            if (el[INTERNAL_PROPS.processedContext])
                return window.top !== el[INTERNAL_PROPS.processedContext];

            return window.top.document !== domUtils.findDocument(el);
        }
        catch (e) {
            return true;
        }
    }

    attachEventEmitter (domProcessor) {
        const eventEmitter = new EventEmitter();

        domProcessor.on   = (evt, listener) => eventEmitter.on(evt, listener);
        domProcessor.off  = (evt, listener) => eventEmitter.off(evt, listener);
        domProcessor.emit = (...args) => fastApply(eventEmitter, 'emit', args);
    }

    getCrossDomainPort () {
        return settings.get().crossDomainProxyPort;
    }

    getProxyUrl () {
        return getProxyUrl.apply(null, arguments);
    }

    isTopParentIframe (el) {
        const elWindow = el[INTERNAL_PROPS.processedContext];

        return elWindow && window.top === elWindow.parent;
    }

    sameOriginCheck (location, checkedUrl) {
        return sameOriginCheck(location, checkedUrl);
    }

    isExistingTarget (target) {
        return !!findByName(target);
    }
}
