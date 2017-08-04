/* eslint hammerhead/proto-methods: 0 */
import BaseDomAdapter from './base-dom-adapter';
import events from 'events';
import * as urlUtils from '../../utils/url';
import * as parse5Utils from '../../utils/parse5';
import { SVG_NAMESPACE } from './namespaces';
import { isIframeFlagTag } from './index';

export default class Parse5DomAdapter extends BaseDomAdapter {
    constructor (isIframe, crossDomainPort) {
        super();

        this.isIframe        = isIframe;
        this.crossDomainPort = crossDomainPort;
    }

    removeAttr (el, attr) {
        parse5Utils.removeAttr(el, attr);
    }

    getAttr (el, attr) {
        return parse5Utils.getAttr(el, attr);
    }

    getClassName (el) {
        return this.getAttr(el, 'class') || '';
    }

    hasAttr (el, attr) {
        return this.getAttr(el, attr) !== null;
    }

    isSVGElement (el) {
        return el.namespaceURI === SVG_NAMESPACE;
    }

    hasEventHandler (el) {
        for (let i = 0; i < el.attrs.length; i++) {
            if (this.EVENTS.indexOf(el.attrs[i].name))
                return true;
        }

        return false;
    }

    getTagName (el) {
        return (el.tagName || '').toLowerCase();
    }

    setAttr (el, attr, value) {
        return parse5Utils.setAttr(el, attr, value);
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

    needToProcessContent () {
        return true;
    }

    needToProcessUrl (tagName, target) {
        if (isIframeFlagTag(tagName) && target === '_parent')
            return false;

        return true;
    }

    attachEventEmitter (domProcessor) {
        const eventEmitter = new events.EventEmitter();

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
