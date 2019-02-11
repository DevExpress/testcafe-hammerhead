import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import EventEmitter from '../utils/event-emitter';
import BaseDomAdapter from '../../processing/dom/base-dom-adapter';
import nativeMethods from '../sandbox/native-methods';
import settings from '../settings';
import { sameOriginCheck } from '../utils/destination-location';
import { getProxyUrl } from '../utils/url';
import * as domUtils from '../utils/dom';
import fastApply from '../utils/fast-apply';
import DocumentWriter from '../sandbox/node/document/writer';
import { findByName } from '../sandbox/windows-storage';

export default class ClientDomAdapter extends BaseDomAdapter {
    removeAttr (el: HTMLElement, attr: string) {
        return nativeMethods.removeAttribute.call(el, attr);
    }

    getAttr (el: HTMLElement, attr: string) {
        return nativeMethods.getAttribute.call(el, attr);
    }

    hasAttr (el: HTMLElement, attr: string): boolean {
        return el.hasAttribute(attr);
    }

    isSVGElement (el: HTMLElement): boolean {
        return domUtils.isSVGElement(el);
    }

    getClassName (el: HTMLElement) {
        return el.className;
    }

    hasEventHandler (el: HTMLElement): boolean {
        const attributes = nativeMethods.elementAttributesGetter.call(el);

        for (const attr of attributes) {
            if (this.EVENTS.indexOf(attr.name) !== -1)
                return true;
        }

        return false;
    }

    getTagName (el): string {
        return domUtils.getTagName(el);
    }

    setAttr (el: HTMLElement, attr: string, value: string): void {
        return nativeMethods.setAttribute.call(el, attr, value);
    }

    setScriptContent (script: HTMLElement, content: string): void {
        nativeMethods.scriptTextSetter.call(script, content);
    }

    getScriptContent (script: HTMLElement) {
        return nativeMethods.scriptTextGetter.call(script);
    }

    getStyleContent (style: HTMLElement) {
        return nativeMethods.elementInnerHTMLGetter.call(style);
    }

    setStyleContent (style: HTMLElement, content: string) {
        nativeMethods.elementInnerHTMLSetter.call(style, content);
    }

    needToProcessContent (el: HTMLElement): boolean {
        return !DocumentWriter.hasUnclosedElementFlag(el);
    }

    needToProcessUrl (): boolean {
        return true;
    }

    hasIframeParent (el: HTMLElement): boolean {
        try {
            if (el[INTERNAL_PROPS.processedContext])
                return window.top !== el[INTERNAL_PROPS.processedContext];

            return window.top.document !== domUtils.findDocument(el);
        }
        catch (e) {
            return true;
        }
    }

    attachEventEmitter (domProcessor): void {
        const eventEmitter = new EventEmitter();

        domProcessor.on   = (evt, listener) => eventEmitter.on(evt, listener);
        domProcessor.off  = (evt, listener) => eventEmitter.off(evt, listener);
        domProcessor.emit = (...args) => fastApply(eventEmitter, 'emit', args);
    }

    getCrossDomainPort (): string {
        return settings.get().crossDomainProxyPort;
    }

    getProxyUrl (): string {
        return getProxyUrl.apply(null, arguments);
    }

    isTopParentIframe (el: HTMLElement): boolean {
        const elWindow = el[INTERNAL_PROPS.processedContext];

        return elWindow && window.top === elWindow.parent;
    }

    sameOriginCheck (location: string, checkedUrl: string) {
        return sameOriginCheck(location, checkedUrl);
    }

    isExistingTarget (target: string) {
        return !!findByName(target);
    }
}
