// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { ASTNode } from 'parse5';

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

    abstract removeAttr (el: HTMLElement | ASTNode, attr: string): void;
    abstract getAttr (el: HTMLElement | ASTNode, attr: string): string | null;
    abstract hasAttr (el: HTMLElement | ASTNode, attr: string): boolean;
    abstract isSVGElement (el: HTMLElement | ASTNode): boolean;
    abstract hasEventHandler (el: HTMLElement | ASTNode): boolean;
    abstract getTagName (el: Element | ASTNode): string;
    abstract setAttr (el: HTMLElement | ASTNode, attr: string, value: string): void;
    abstract setScriptContent (el: HTMLElement | ASTNode, content: string): void;
    abstract getScriptContent (el: HTMLElement | ASTNode): string;
    abstract getStyleContent (el: HTMLElement | ASTNode): string;
    abstract setStyleContent (el: HTMLElement | ASTNode, content: string): void;
    abstract needToProcessContent (el: HTMLElement | ASTNode): boolean;
    abstract needToProcessUrl (tagName: string, target: string): boolean;
    abstract hasIframeParent (el: HTMLElement | ASTNode): boolean;
    abstract getProxyUrl (resourceUrl: string, opts: object): string;
    abstract isTopParentIframe (el: HTMLElement | ASTNode): boolean;
    abstract sameOriginCheck (destUrl: string, resourceUrl: string): boolean;
    abstract getClassName (el: Element | ASTNode): string;
    abstract isExistingTarget (target: string, el?: HTMLElement | ASTNode): boolean;
    abstract processSrcdocAttr (string: string): string;
}
