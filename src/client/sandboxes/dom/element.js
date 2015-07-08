import * as DOM from '../../util/dom';
import { stopPropagation } from '../../util/event';
import * as HiddenInfo from '../upload/hidden-info';
import IFrameSandbox from '../iframe';
import * as InfoManager from '../upload/info-manager';
import NativeMethods from '../native-methods';
import DomProcessor from '../../dom-processor/dom-processor';
import ScriptProcessor from '../../../processing/script';
import { isPageHtml, processHtml } from '../../util/html';
import { EventEmitter } from '../../util/service';
import { onBodyElementMutation } from '../shadow-ui';
import { waitCookieMsg } from '../../transport';
import UrlUtil from '../../util/url';

export const IFRAME_ADDED = 'iframeAdded';

var eventEmitter = new EventEmitter();

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

var overrideElementContent = null;

function overridedInsertRow () {
    var tagName    = this.tagName.toLowerCase();
    var nativeMeth = tagName === 'table' ? NativeMethods.insertTableRow : NativeMethods.insertTBodyRow;
    var row        = nativeMeth.apply(this, arguments);

    overrideElementContent(row);

    return row;
}

function overridedInsertCell () {
    var cell = NativeMethods.insertCell.apply(this, arguments);

    overrideElementContent(cell);

    return cell;
}

function overridedInsertAdjacentHTML (pos, html) {
    if (html !== null)
        html = processHtml('' + html, this.parentNode && this.parentNode.tagName);

    NativeMethods.insertAdjacentHTML.call(this, pos, html);
    overrideElementContent(this.parentNode || this);
}

function overridedFormSubmit () {
    var form = this;

    waitCookieMsg(function () {
        NativeMethods.formSubmit.apply(form, arguments);
    });
}

function overridedInsertBefore (newNode, refNode) {
    overrideElementContent(newNode);

    var result = NativeMethods.insertBefore.call(this, newNode, refNode);

    onElementAdded(newNode);

    return result;
}

function overridedAppendChild (child) {
    //NOTE: we should process a TextNode as a script if it is appended to a script element (B254284)
    if (child.nodeType === 3 && this.tagName && this.tagName.toLowerCase() === 'script')
        child.data = ScriptProcessor.process(child.data);

    overrideElementContent(child);

    var result = null;

    /*eslint-disable indent */
    if (this.tagName && this.tagName.toLowerCase() === 'body' && this.children.length) {
        // NOTE: We should to append element before shadow ui root
        var lastChild = this.children[this.children.length - 1];

        result = NativeMethods.insertBefore.call(this, child, lastChild);
    }
    else
        result = NativeMethods.appendChild.call(this, child);
    /*eslint-enable indent */

    onElementAdded(child);

    return result;
}

function overridedRemoveChild (child) {
    if (DOM.isDomElement(child)) {
        DOM.find(child, 'input[type=file]', removeFileInputInfo);

        if (DOM.isFileInput(child))
            removeFileInputInfo(child);
    }

    var result = NativeMethods.removeChild.call(this, child);

    onElementRemoved(child);

    return result;
}

function overridedCloneNode () {
    var clone = NativeMethods.cloneNode.apply(this, arguments);

    overrideElementContent(clone);

    return clone;
}

function overridedGetAttribute (attr) {
    return overridedGetAttributeCore(this, attr);
}

function overridedGetAttributeNS (ns, attr) {
    return overridedGetAttributeCore(this, attr, ns);
}

function overridedGetAttributeCore (el, attr, ns) {
    var getAttrMeth = ns ? NativeMethods.getAttributeNS : NativeMethods.getAttribute;

    // Optimization: hasAttribute meth is very slow
    if (isUrlAttr(el, attr) || attr === 'sandbox' || DomProcessor.EVENTS.indexOf(attr) !== -1 ||
        attr === 'autocomplete') {
        var storedAttr = DomProcessor.getStoredAttrName(attr);

        if (attr === 'autocomplete' && getAttrMeth.apply(el, ns ? [ns, storedAttr] : [storedAttr]) === 'none')
            return null;
        else if (el.hasAttribute(storedAttr))
            attr = storedAttr;
    }

    return getAttrMeth.apply(el, ns ? [ns, attr] : [attr]);
}

function overridedSetAttribute (attr, value) {
    return overridedSetAttributeCore(this, attr, value);
}

function overridedSetAttributeNS (ns, attr, value) {
    return overridedSetAttributeCore(this, attr, value, ns);
}

function overridedSetAttributeCore (el, attr, value, ns) {
    var setAttrMeth         = ns ? NativeMethods.setAttributeNS : NativeMethods.setAttribute;
    var tagName             = el.tagName.toLowerCase();
    var isSupportedProtocol = UrlUtil.isSupportedProtocol(value);
    var urlAttr             = isUrlAttr(el, attr);
    var isEventAttr         = DomProcessor.EVENTS.indexOf(attr) !== -1;

    value += '';

    if (urlAttr && !isSupportedProtocol || isEventAttr) {
        var isJsProtocol = DomProcessor.JAVASCRIPT_PROTOCOL_REG_EX.test(value);
        var storedJsAttr = DomProcessor.getStoredAttrName(attr);

        /*eslint-disable indent */
        if (urlAttr && isJsProtocol || isEventAttr) {
            var valueWithoutProtocol = value.replace(DomProcessor.JAVASCRIPT_PROTOCOL_REG_EX, '');
            var matches              = valueWithoutProtocol.match(DomProcessor.HTML_STRING_REG_EX);
            var processedValue       = '';

            if (matches && isJsProtocol) {
                var html        = matches[2];
                var stringQuote = matches[1];

                if (!isPageHtml(html))
                    html = '<html><body>' + html + '</body></html>';

                html = html.replace(new RegExp('\\\\' + stringQuote, 'g'), stringQuote);
                html = processHtml(html);
                html = html.replace(new RegExp(stringQuote, 'g'), '\\' + stringQuote);

                /*eslint-disable no-script-url */
                processedValue = 'javascript:' + stringQuote + html + stringQuote;
                /*eslint-enable no-script-url */
            }
            else
            /*eslint-disable no-script-url */
                processedValue = (isJsProtocol ? 'javascript:' : '') +
                                 ScriptProcessor.process(valueWithoutProtocol, true);
            /*eslint-enable no-script-url */

            if (processedValue !== value) {
                setAttrMeth.apply(el, ns ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
                value = processedValue;
            }
        }
        else
            setAttrMeth.apply(el, ns ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
        /*eslint-enable indent */
    }
    else if (urlAttr && isSupportedProtocol) {
        var storedUrlAttr = DomProcessor.getStoredAttrName(attr);

        setAttrMeth.apply(el, ns ? [ns, storedUrlAttr, value] : [storedUrlAttr, value]);

        /*eslint-disable indent */
        if (tagName !== 'img') {
            if (value !== '') {
                var isIframe         = tagName === 'iframe';
                var isScript         = tagName === 'script';
                var isCrossDomainUrl = isSupportedProtocol && !UrlUtil.sameOriginCheck(location.toString(), value);
                var resourceType     = null;

                if (isScript)
                    resourceType = UrlUtil.SCRIPT;
                else if (isIframe || DomProcessor.isOpenLinkInIFrame(el))
                    resourceType = UrlUtil.IFRAME;

                value = isIframe && isCrossDomainUrl ? UrlUtil.getCrossDomainIframeProxyUrl(value) :
                        UrlUtil.getProxyUrl(value, null, null, null, null, resourceType);
            }
        }
        else if (value && !UrlUtil.parseProxyUrl(value))
            value = UrlUtil.resolveUrlAsOrigin(value);
        /*eslint-enable indent */

    }
    else if (attr === 'autocomplete') {
        var storedAutocompleteAttr = DomProcessor.getStoredAttrName(attr);

        setAttrMeth.apply(el, ns ? [ns, storedAutocompleteAttr, value] : [storedAutocompleteAttr, value]);

        value = 'off';
    }
    else if (attr === 'target' && value === '_blank' && DomProcessor.TARGET_ATTR_TAGS[tagName])
        return null;
    else if (attr === 'sandbox' && value.indexOf('allow-scripts') === -1) {
        var storedSandboxAttr = DomProcessor.getStoredAttrName(attr);

        setAttrMeth.apply(el, ns ? [ns, storedSandboxAttr, value] : [storedSandboxAttr, value]);
        value += ' allow-scripts';
    }

    return setAttrMeth.apply(el, ns ? [ns, attr, value] : [attr, value]);
}

function overridedRemoveAttribute () {
    overridedRemoveAttributeCore.call(this, false, arguments);
}

function overridedRemoveAttributeNS () {
    overridedRemoveAttributeCore.call(this, true, arguments);
}

function overridedRemoveAttributeCore (ns, arg) {
    var attr           = ns ? arg[1] : arg[0];
    var removeAttrFunc = ns ? NativeMethods.removeAttributeNS : NativeMethods.removeAttribute;

    if (isUrlAttr(this, attr) || attr === 'sandbox' || attr === 'autocomplete' ||
        DomProcessor.EVENTS.indexOf(attr) !== -1) {
        var storedAttr = DomProcessor.getStoredAttrName(attr);

        if (attr === 'autocomplete')
            NativeMethods.setAttribute.call(this, storedAttr, 'none');
        else
            removeAttrFunc.apply(this, ns ? [arg[0], storedAttr] : [storedAttr]);
    }

    if (attr !== 'autocomplete')
        return removeAttrFunc.apply(this, arg);
}

function isUrlAttr (el, attr) {
    var tagName = el.tagName.toLowerCase();

    return DomProcessor.URL_ATTR_TAGS[attr] && DomProcessor.URL_ATTR_TAGS[attr].indexOf(tagName) !== -1;
}

function removeFileInputInfo (el) {
    HiddenInfo.removeInputInfo(el);
}

function onElementAdded (el) {
    if ((el.nodeType === 1 || el.nodeType === 9) && DOM.isElementInDocument(el)) {
        var iframes = getIframes(el);

        /*eslint-disable indent */
        if (iframes.length) {
            for (var i = 0; i < iframes.length; i++)
                onIFrameAddedToDOM(iframes[i]);
        }
        else if (el.tagName && el.tagName.toLowerCase() === 'body')
            onBodyElementMutation();
        /*eslint-enable indent */
    }

    if (DOM.isDomElement(el)) {
        DOM.find(el, 'input[type=file]', addFileInputInfo);

        if (DOM.isFileInput(el))
            addFileInputInfo(el);
    }
}

function onElementRemoved (el) {
    if (el.nodeType === 1 && el.tagName && el.tagName.toLowerCase() === 'body')
        onBodyElementMutation();
}

function getIframes (el) {
    var isIframe = el.tagName && el.tagName.toLowerCase() === 'iframe';

    return isIframe ? [el] : el.querySelectorAll('iframe');
}

function addFileInputInfo (el) {
    HiddenInfo.addInputInfo(el, InfoManager.getFiles(el), InfoManager.getValue(el));
}

function onIFrameAddedToDOM (iframe) {
    if (!DOM.isCrossDomainIframe(iframe, true)) {
        eventEmitter.emit(IFRAME_ADDED, {
            iframe: iframe
        });

        IFrameSandbox.iframeAddedToDom(iframe);
    }
}

export function init (window, overrideFunc) {
    overrideElementContent = overrideFunc;

    window.Element.prototype.insertBefore              = overridedInsertBefore;
    window.Element.prototype.appendChild               = overridedAppendChild;
    window.Element.prototype.removeChild               = overridedRemoveChild;
    window.Element.prototype.setAttribute              = overridedSetAttribute;
    window.Element.prototype.setAttributeNS            = overridedSetAttributeNS;
    window.Element.prototype.getAttribute              = overridedGetAttribute;
    window.Element.prototype.getAttributeNS            = overridedGetAttributeNS;
    window.Element.prototype.removeAttribute           = overridedRemoveAttribute;
    window.Element.prototype.removeAttributeNS         = overridedRemoveAttributeNS;
    window.Element.prototype.cloneNode                 = overridedCloneNode;
    window.Node.prototype.cloneNode                    = overridedCloneNode;
    window.Node.prototype.appendChild                  = overridedAppendChild;
    window.Node.prototype.removeChild                  = overridedRemoveChild;
    window.Node.prototype.insertBefore                 = overridedInsertBefore;
    window.HTMLTableElement.prototype.insertRow        = overridedInsertRow;
    window.HTMLTableSectionElement.prototype.insertRow = overridedInsertRow;
    window.HTMLTableRowElement.prototype.insertCell    = overridedInsertCell;
    window.HTMLFormElement.prototype.submit            = overridedFormSubmit;
}

export function override (el) {
    var isDocFragment = el.nodeType === 11;
    var elTagName     = el.tagName && el.tagName.toLowerCase();
    var isForm        = elTagName === 'form';
    var isIframe      = elTagName === 'iframe';

    if (!isDocFragment)
        DomProcessor.processElement(el, UrlUtil.convertToProxyUrl);

    if (elTagName === 'img') {
        el.addEventListener('error', function (e) {
            var storedAttr = NativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('src'));

            if (storedAttr && !UrlUtil.parseProxyUrl(el.src) && UrlUtil.isSupportedProtocol(el.src)) {
                NativeMethods.setAttribute.call(el, 'src', UrlUtil.getProxyUrl(storedAttr));
                stopPropagation(e);
            }
        }, false);
    }

    if (isIframe && !DOM.isCrossDomainIframe(el, true))
        IFrameSandbox.overrideIframe(el);

    if ('insertAdjacentHTML' in el)
        el.insertAdjacentHTML = overridedInsertAdjacentHTML;

    el.insertBefore = overridedInsertBefore;
    el.appendChild  = overridedAppendChild;
    el.removeChild  = overridedRemoveChild;
    el.cloneNode    = overridedCloneNode;

    if (!isDocFragment) {
        el.setAttribute      = overridedSetAttribute;
        el.setAttributeNS    = overridedSetAttributeNS;
        el.getAttribute      = overridedGetAttribute;
        el.getAttributeNS    = overridedGetAttributeNS;
        el.removeAttribute   = overridedRemoveAttribute;
        el.removeAttributeNS = overridedRemoveAttributeNS;
    }

    if ('insertRow' in el)
        el.insertRow = overridedInsertRow;

    if ('insertCell' in el)
        el.insertCell = overridedInsertCell;

    if (isForm)
        el.submit = overridedFormSubmit;
}
