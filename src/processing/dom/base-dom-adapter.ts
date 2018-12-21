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

    abstract removeAttr (el: any, attr: string): void;
    abstract getAttr (el:any, attr:string) : string;
    abstract hasAttr (el:any, attr: string) : boolean;
    abstract isSVGElement (el:any): boolean;
    abstract hasEventHandler (el: any): boolean;
    abstract getTagName (el:any): string;
    abstract setAttr (el: any, attr: string, value: string) : void;
    abstract setScriptContent (el: any, content: string): void;
    abstract getScriptContent (el: any): string;
    abstract getStyleContent (el: any): string;
    abstract setStyleContent (el: any, content: string): void;
    abstract needToProcessContent (el: any): boolean;
    abstract needToProcessUrl (tagName: string, target: string): boolean;
    abstract attachEventEmitter (domProcessor: any): void;
    abstract hasIframeParent (el: any) : boolean;
    abstract getCrossDomainPort (): string;
    abstract getProxyUrl (resourceUrl: string, opts: object): string;
    abstract isTopParentIframe (el: any): boolean;
    abstract sameOriginCheck (destUrl: string, resourceUrl: string): boolean;
    abstract getClassName (el: any): string;
    abstract isExistingTarget (target: string): boolean;
}
