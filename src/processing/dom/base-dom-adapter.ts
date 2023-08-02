// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { Node } from 'parse5/dist/tree-adapters/default';

export default abstract class BaseDomAdapter {
    EVENTS: string[] = ['onblur', 'onchange', 'onclick', 'oncontextmenu', 'oncopy', 'oncut',
        'ondblclick', 'onerror', 'onfocus', 'onfocusin', 'onfocusout', 'onhashchange', 'onkeydown',
        'onkeypress', 'onkeyup', 'onload', 'onmousedown', 'onmouseenter', 'onmouseleave',
        'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel', 'onpaste', 'onreset',
        'onresize', 'onscroll', 'onselect', 'onsubmit', 'ontextinput', 'onunload', 'onwheel',
        'onpointerdown', 'onpointerup', 'onpointercancel', 'onpointermove', 'onpointerover', 'onpointerout',
        'onpointerenter', 'onpointerleave', 'ongotpointercapture', 'onlostpointercapture',
        'onmspointerdown', 'onmspointerup', 'onmspointercancel', 'onmspointermove', 'onmspointerover',
        'onmspointerout', 'onmspointerenter', 'onmspointerleave', 'onmsgotpointercapture', 'onmslostpointercapture',
    ];

    abstract removeAttr (el: HTMLElement | Node, attr: string): void;
    abstract getAttr (el: HTMLElement | Node, attr: string): string | null;
    abstract hasAttr (el: HTMLElement | Node, attr: string): boolean;
    abstract isSVGElement (el: HTMLElement | Node): boolean;
    abstract hasEventHandler (el: HTMLElement | Node): boolean;
    abstract getTagName (el: Element | Node): string;
    abstract setAttr (el: HTMLElement | Node, attr: string, value: string): void;
    abstract setScriptContent (el: HTMLElement | Node, content: string): void;
    abstract getScriptContent (el: HTMLElement | Node): string;
    abstract getStyleContent (el: HTMLElement | Node): string;
    abstract setStyleContent (el: HTMLElement | Node, content: string): void;
    abstract needToProcessContent (el: HTMLElement | Node): boolean;
    abstract needToProcessUrl (tagName: string, target: string): boolean;
    abstract hasIframeParent (el: HTMLElement | Node): boolean;
    abstract getProxyUrl (resourceUrl: string, opts: object): string;
    abstract isTopParentIframe (el: HTMLElement | Node): boolean;
    abstract sameOriginCheck (destUrl: string, resourceUrl: string): boolean;
    abstract getClassName (el: Element | Node): string;
    abstract isExistingTarget (target: string, el?: HTMLElement | Node): boolean;
    abstract processSrcdocAttr (string: string): string;
}
