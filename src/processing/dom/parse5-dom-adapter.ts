/* eslint hammerhead/proto-methods: 0 */
import BaseDomAdapter from './base-dom-adapter';
import events from 'events';
import * as urlUtils from '../../utils/url';
import * as parse5Utils from '../../utils/parse5';
import { SVG_NAMESPACE } from './namespaces';
import DomProcessor from './index';
import { ASTNode } from 'parse5';

export default class Parse5DomAdapter extends BaseDomAdapter {
    constructor (public readonly isIframe: boolean,
        public readonly crossDomainPort: string,
        public readonly workerHammerheadUrl: string) {
        super();
    }

    removeAttr (el: ASTNode, attr: string): void {
        parse5Utils.removeAttr(el, attr);
    }

    getAttr (el: ASTNode, attr: string): string {
        return parse5Utils.getAttr(el, attr);
    }

    getClassName (el: ASTNode): string {
        return this.getAttr(el, 'class') || '';
    }

    hasAttr (el: ASTNode, attr: string): boolean {
        return this.getAttr(el, attr) !== null;
    }

    isSVGElement (el: ASTNode): boolean {
        return el.namespaceURI === SVG_NAMESPACE;
    }

    hasEventHandler (el: ASTNode): boolean {
        for (let i = 0; i < el.attrs.length; i++) {
            if (this.EVENTS.includes(el.attrs[i].name))
                return true;
        }

        return false;
    }

    getTagName (el: ASTNode): string {
        return (el.tagName || '').toLowerCase();
    }

    setAttr (el: ASTNode, attr: string, value: string) {
        return parse5Utils.setAttr(el, attr, value);
    }

    setScriptContent (script: ASTNode, content: string): void {
        script.childNodes = [parse5Utils.createTextNode(content, script)];
    }

    getScriptContent (script: ASTNode): string {
        return script.childNodes.length ? script.childNodes[0].value : '';
    }

    getStyleContent (style: ASTNode): string {
        return style.childNodes.length ? style.childNodes[0].value : '';
    }

    setStyleContent (style: ASTNode, content: string): void {
        style.childNodes = [parse5Utils.createTextNode(content, style)];
    }

    needToProcessContent (): boolean {
        return true;
    }

    needToProcessUrl (tagName: string, target: string): boolean {
        if (DomProcessor.isIframeFlagTag(tagName) && target === '_parent')
            return false;

        return true;
    }

    attachEventEmitter (domProcessor): void {
        const eventEmitter = new events.EventEmitter();

        domProcessor.on   = eventEmitter.on.bind(eventEmitter);
        domProcessor.off  = eventEmitter.removeListener.bind(eventEmitter);
        domProcessor.emit = eventEmitter.emit.bind(eventEmitter);
    }

    hasIframeParent (): boolean {
        return this.isIframe;
    }

    getCrossDomainPort (): string {
        return this.crossDomainPort;
    }

    getProxyUrl (): string {
        return urlUtils.getProxyUrl.apply(urlUtils, arguments);
    }

    isTopParentIframe (): boolean {
        return false;
    }

    sameOriginCheck (location: string, checkedUrl: string): boolean {
        return urlUtils.sameOriginCheck(location, checkedUrl);
    }

    isExistingTarget (target: string, el: ASTNode): boolean {
        while (el.parentNode)
            el = el.parentNode;

        return parse5Utils.findElement(el, e => this.getAttr(e, 'name') === target);
    }

    getWorkerHammerheadUrl () {
        return this.workerHammerheadUrl;
    }
}
