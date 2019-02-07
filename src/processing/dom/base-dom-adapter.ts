// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

export default abstract class BaseDomAdapter {
    EVENTS: string[] = ['onblur', 'onchange', 'onclick', 'oncontextmenu', 'oncopy', 'oncut',
        'ondblclick', 'onerror', 'onfocus', 'onfocusin', 'onfocusout', 'onhashchange', 'onkeydown',
        'onkeypress', 'onkeyup', 'onload', 'onmousedown', 'onmouseenter', 'onmouseleave',
        'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel', 'onpaste', 'onreset',
        'onresize', 'onscroll', 'onselect', 'onsubmit', 'ontextinput', 'onunload', 'onwheel',
        'onpointerdown', 'onpointerup', 'onpointercancel', 'onpointermove', 'onpointerover', 'onpointerout',
        'onpointerenter', 'onpointerleave', 'ongotpointercapture', 'onlostpointercapture',
        'onmspointerdown', 'onmspointerup', 'onmspointercancel', 'onmspointermove', 'onmspointerover',
        'onmspointerout', 'onmspointerenter', 'onmspointerleave', 'onmsgotpointercapture', 'onmslostpointercapture'
    ];

    abstract removeAttr (el: HTMLElement, attr: string): void;
    abstract getAttr (el:HTMLElement, attr:string) : string;
    abstract hasAttr (el:HTMLElement, attr: string) : boolean;
    abstract isSVGElement (el:HTMLElement): boolean;
    abstract hasEventHandler (el: HTMLElement): boolean;
    abstract getTagName (el:HTMLElement): string;
    abstract setAttr (el: HTMLElement, attr: string, value: string) : void;
    abstract setScriptContent (el: HTMLElement, content: string): void;
    abstract getScriptContent (el: HTMLElement): string;
    abstract getStyleContent (el: HTMLElement): string;
    abstract setStyleContent (el: HTMLElement, content: string): void;
    abstract needToProcessContent (el: HTMLElement): boolean;
    abstract needToProcessUrl (tagName: string, target: string): boolean;
    abstract attachEventEmitter (domProcessor: any): void;
    abstract hasIframeParent (el: HTMLElement) : boolean;
    abstract getCrossDomainPort (): string;
    abstract getProxyUrl (resourceUrl: string, opts: object): string;
    abstract isTopParentIframe (el: HTMLElement): boolean;
    abstract sameOriginCheck (destUrl: string, resourceUrl: string): boolean;
    abstract getClassName (el: HTMLElement): string;
    abstract isExistingTarget (target: string): boolean;
}
