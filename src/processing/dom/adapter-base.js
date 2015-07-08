export default class DomProcessorStrategy {
    constructor () {
        this.EVENTS = ['onblur', 'onchange', 'onclick', 'oncontextmenu', 'oncopy', 'oncut',
            'ondblclick', 'onerror', 'onfocus', 'onfocusin', 'onfocusout', 'onhashchange', 'onkeydown',
            'onkeypress', 'onkeyup', 'onload', 'onmousedown', 'onmouseenter', 'onmouseleave',
            'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel', 'onpaste', 'onreset',
            'onresize', 'onscroll', 'onselect', 'onsubmit', 'ontextinput', 'onunload', 'onwheel',
            'onpointerdown', 'onpoi nterup', 'onpointercancel', 'onpointermove', 'onpointerover', 'onpointerout',
            'onpointerenter', 'onpointerleave', 'ongotpointercapture', 'onlostpointercapture',
            'onmspointerdown', 'onmspointerup', 'onmspointercancel', 'onmspointermove', 'onmspointerover',
            'onmspointerout', 'onmspointerenter', 'onmspointerleave', 'onmsgotpointercapture', 'onmslostpointercapture'
        ];

        this.IFRAME_FLAG_TAGS = ['a', 'form'];
    }

    getAttr () {
        throw new Error('Not implemented');
    }

    hasAttr () {
        throw new Error('Not implemented');
    }

    hasEventHandler () {
        throw new Error('Not implemented');
    }

    getTagName () {
        throw new Error('Not implemented');
    }

    setAttr () {
        throw new Error('Not implemented');
    }

    setScriptContent () {
        throw new Error('Not implemented');
    }

    getScriptContent () {
        throw new Error('Not implemented');
    }

    getStyleContent () {
        throw new Error('Not implemented');
    }

    setStyleContent () {
        throw new Error('Not implemented');
    }

    getElementForSelectorCheck () {
        throw new Error('Not implemented');
    }

    needToProcessUrl () {
        throw new Error('Not implemented');
    }

    attachEventEmitter () {
        throw new Error('Not implemented');
    }

    hasIFrameParent () {
        throw new Error('Not implemented');
    }

    getCrossDomainPort () {
        throw new Error('Not implemented');
    }

    getProxyUrl () {
        throw new Error('Not implemented');
    }

    isTopParentIFrame () {
        throw new Error('Not implemented');
    }
}
