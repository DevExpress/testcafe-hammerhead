/* eslint hammerhead/proto-methods: 0 */
import BaseDomAdapter from './base-dom-adapter';
import * as urlUtils from '../../utils/url';
import * as parse5Utils from '../../utils/parse5';
import { SVG_NAMESPACE } from './namespaces';
import DomProcessor from './index';
import {
    Node,
    Element,
    ChildNode,
    TextNode,
} from 'parse5/dist/tree-adapters/default';
import pageProcessor from '../resources/page';
import Charset from '../encoding/charset';
import RequestPipelineContext from '../../request-pipeline/context';

export default class Parse5DomAdapter extends BaseDomAdapter {
    constructor (public readonly isIframe: boolean,
        private ctx: RequestPipelineContext,
        private charset: Charset,
        private urlReplacer: Function) {
        super();
    }

    removeAttr (el: Element, attr: string): void {
        parse5Utils.removeAttr(el, attr);
    }

    getAttr (el: Node, attr: string): string | null {
        return parse5Utils.getAttr(el, attr);
    }

    getClassName (el: Node): string {
        return this.getAttr(el, 'class') || '';
    }

    hasAttr (el: Node, attr: string): boolean {
        return this.getAttr(el, attr) !== null;
    }

    isSVGElement (el: Element): boolean {
        return el.namespaceURI === SVG_NAMESPACE;
    }

    hasEventHandler (el: Element): boolean {
        for (let i = 0; i < el.attrs.length; i++) {
            if (this.EVENTS.includes(el.attrs[i].name))
                return true;
        }

        return false;
    }

    getTagName (el: Element): string {
        return (el.tagName || '').toLowerCase();
    }

    setAttr (el: Element, attr: string, value: string) {
        return parse5Utils.setAttr(el, attr, value);
    }

    setScriptContent (script: Element, content: string): void {
        script.childNodes = [parse5Utils.createTextNode(content, script) as ChildNode];
    }

    getScriptContent (script: Element): string {
        return (script.childNodes?.[0] as TextNode)?.value || '';
    }

    getStyleContent (style: Element): string {
        return (style.childNodes?.[0] as TextNode)?.value || '';
    }

    setStyleContent (style: Element, content: string): void {
        style.childNodes = [parse5Utils.createTextNode(content, style) as ChildNode];
    }

    needToProcessContent (): boolean {
        return true;
    }

    needToProcessUrl (tagName: string, target: string): boolean {
        return !DomProcessor.isIframeFlagTag(tagName) || target !== '_parent';
    }

    hasIframeParent (): boolean {
        return this.isIframe;
    }

    getProxyUrl (...args: [string, any]): string {
        return urlUtils.getProxyUrl(...args);
    }

    isTopParentIframe (): boolean {
        return false;
    }

    sameOriginCheck (location: string, checkedUrl: string): boolean {
        return urlUtils.sameOriginCheck(location, checkedUrl);
    }

    isExistingTarget (target: string, el: Element): boolean {
        while (el.parentNode)
            el = el.parentNode as Element;

        return !!parse5Utils.findElement(el, e => this.getAttr(e, 'name') === target);
    }

    processSrcdocAttr (html: string): string {
        return pageProcessor.processResource(html, this.ctx, this.charset, this.urlReplacer, true) as string;
    }
}
