import SandboxBase from '../base';
import NodeSandbox from '../node/index';
import nativeMethods from '../native-methods';
import domProcessor from '../../dom-processor';
import { processScript } from '../../../processing/script';
import { process as processStyle } from '../../../processing/style';
import * as urlUtils from '../../utils/url';
import * as domUtils from '../../utils/dom';
import * as hiddenInfo from '../upload/hidden-info';
import * as urlResolver from '../../utils/url-resolver';
import { sameOriginCheck, get as getDestLocation } from '../../utils/destination-location';
import { stopPropagation } from '../../utils/event';
import { isPageHtml, processHtml } from '../../utils/html';
import { waitCookieMsg } from '../../transport';

export default class ElementSandbox extends SandboxBase {
    constructor (nodeSandbox, uploadSandbox, iframeSandbox, shadowUI) {
        super();

        this.nodeSandbox   = nodeSandbox;
        this.shadowUI      = shadowUI;
        this.uploadSandbox = uploadSandbox;
        this.iframeSandbox = iframeSandbox;

        this.overridedMethods = null;
    }

    _overridedGetAttributeCore (el, attr, ns) {
        var getAttrMeth = ns ? nativeMethods.getAttributeNS : nativeMethods.getAttribute;

        // OPTIMIZATION: The hasAttribute method is very slow.
        if (ElementSandbox._isUrlAttr(el, attr) || attr === 'sandbox' || domProcessor.EVENTS.indexOf(attr) !== -1 ||
            attr === 'autocomplete') {
            var storedAttr = domProcessor.getStoredAttrName(attr);

            if (attr === 'autocomplete' && getAttrMeth.apply(el, ns ? [ns, storedAttr] : [storedAttr]) === 'none')
                return null;
            else if (el.hasAttribute(storedAttr))
                attr = storedAttr;
        }

        return getAttrMeth.apply(el, ns ? [ns, attr] : [attr]);
    }

    _overridedSetAttributeCore (el, attr, value, ns) {
        var setAttrMeth         = ns ? nativeMethods.setAttributeNS : nativeMethods.setAttribute;
        var tagName             = el.tagName.toLowerCase();
        var isSupportedProtocol = urlUtils.isSupportedProtocol(value);
        var urlAttr             = ElementSandbox._isUrlAttr(el, attr);
        var isEventAttr         = domProcessor.EVENTS.indexOf(attr) !== -1;

        value += '';

        if (urlAttr && !isSupportedProtocol || isEventAttr) {
            var isJsProtocol = domProcessor.JAVASCRIPT_PROTOCOL_REG_EX.test(value);
            var storedJsAttr = domProcessor.getStoredAttrName(attr);

            if (urlAttr && isJsProtocol || isEventAttr) {
                var valueWithoutProtocol = value.replace(domProcessor.JAVASCRIPT_PROTOCOL_REG_EX, '');
                var matches              = valueWithoutProtocol.match(domProcessor.HTML_STRING_REG_EX);
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
                else {
                    /*eslint-disable no-script-url */
                    processedValue = (isJsProtocol ? 'javascript:' : '') +
                                     processScript(valueWithoutProtocol, false, false);
                    /*eslint-enable no-script-url */
                }

                setAttrMeth.apply(el, ns ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
                value                    = processedValue;
            }
            else
                setAttrMeth.apply(el, ns ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
        }
        else if (urlAttr && isSupportedProtocol) {
            var storedUrlAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, ns ? [ns, storedUrlAttr, value] : [storedUrlAttr, value]);

            if (tagName !== 'img') {
                if (value !== '') {
                    var isIframe         = tagName === 'iframe';
                    var isScript         = tagName === 'script';
                    var isCrossDomainUrl = isSupportedProtocol && !sameOriginCheck(location.toString(), value);
                    var resourceType     = null;
                    var elCharset        = isScript && el.charset;

                    if (isScript)
                        resourceType = urlUtils.SCRIPT;
                    else if (isIframe || domProcessor.isOpenLinkInIframe(el))
                        resourceType = urlUtils.IFRAME;

                    if (ElementSandbox._isHrefAttrForBaseElement(el, attr))
                        urlResolver.updateBase(value, this.document);

                    value = isIframe && isCrossDomainUrl ? urlUtils.getCrossDomainIframeProxyUrl(value) :
                            urlUtils.getProxyUrl(value, null, null, null, resourceType, elCharset);
                }
            }
            else if (value && !urlUtils.parseProxyUrl(value))
                value = urlUtils.resolveUrlAsDest(value);

        }
        else if (attr === 'autocomplete') {
            var storedAutocompleteAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, ns ? [ns, storedAutocompleteAttr, value] : [storedAutocompleteAttr, value]);

            value = 'off';
        }
        else if (attr === 'target' && value === '_blank' && domProcessor.TARGET_ATTR_TAGS[tagName])
            return null;
        else if (attr === 'sandbox' && value.indexOf('allow-scripts') === -1) {
            var storedSandboxAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, ns ? [ns, storedSandboxAttr, value] : [storedSandboxAttr, value]);
            value += ' allow-scripts';
        }
        // TODO: remove after https://github.com/DevExpress/testcafe-hammerhead/issues/244 implementation
        else if (tagName === 'meta' && ['http-equiv', 'content'].indexOf(attr) !== -1)
            return null;

        return setAttrMeth.apply(el, ns ? [ns, attr, value] : [attr, value]);
    }

    _overridedRemoveAttributeCore (el, ns, arg) {
        var attr           = ns ? arg[1] : arg[0];
        var removeAttrFunc = ns ? nativeMethods.removeAttributeNS : nativeMethods.removeAttribute;

        if (ElementSandbox._isUrlAttr(el, attr) || attr === 'sandbox' || attr === 'autocomplete' ||
            domProcessor.EVENTS.indexOf(attr) !== -1) {
            var storedAttr = domProcessor.getStoredAttrName(attr);

            if (attr === 'autocomplete')
                nativeMethods.setAttribute.call(el, storedAttr, 'none');
            else
                removeAttrFunc.apply(el, ns ? [arg[0], storedAttr] : [storedAttr]);
        }

        if (ElementSandbox._isHrefAttrForBaseElement(el, attr))
            urlResolver.updateBase(getDestLocation(), this.document);

        if (attr !== 'autocomplete')
            return removeAttrFunc.apply(el, arg);
    }

    _prepareNodeForInsertion (node, parentNode) {
        if (node.nodeType === 3)
            ElementSandbox._processTextNodeContent(node, parentNode);

        this.nodeSandbox.overrideDomMethods(node);
    }

    _createOverridedMethods () {
        // NOTE: We need the closure because a context of overridden methods is an html element
        var sandbox = this;

        this.overridedMethods = {
            insertRow () {
                var tagName    = this.tagName.toLowerCase();
                var nativeMeth = tagName === 'table' ? nativeMethods.insertTableRow : nativeMethods.insertTBodyRow;
                var row        = nativeMeth.apply(this, arguments);

                sandbox.nodeSandbox.overrideDomMethods(row);

                return row;
            },

            insertCell () {
                var cell = nativeMethods.insertCell.apply(this, arguments);

                sandbox.nodeSandbox.overrideDomMethods(cell);

                return cell;
            },

            insertAdjacentHTML (pos, html) {
                if (html !== null)
                    html = processHtml('' + html, this.parentNode && this.parentNode.tagName);

                nativeMethods.insertAdjacentHTML.call(this, pos, html);
                sandbox.nodeSandbox.overrideDomMethods(this.parentNode || this);
            },

            formSubmit () {
                // TODO: Don't wait cookie, put them in a form hidden input and parse on the server (GH-199)
                waitCookieMsg().then(() => nativeMethods.formSubmit.apply(this, arguments));
            },

            insertBefore (newNode, refNode) {
                sandbox._prepareNodeForInsertion(newNode, this);

                var result = null;

                // NOTE: Before the page's <body> is processed and added to DOM,
                // some javascript frameworks create their own body element, perform
                // certain manipulations and then remove it.
                // Therefore, we need to check if the body element is present in DOM
                if (domUtils.isBodyElementWithChildren(this) && !refNode && domUtils.isElementInDocument(this))
                    result = sandbox.shadowUI.insertBeforeRoot(newNode);
                else
                    result = nativeMethods.insertBefore.call(this, newNode, refNode);

                sandbox._onElementAdded(newNode);

                return result;
            },

            appendChild (child) {
                sandbox._prepareNodeForInsertion(child, this);

                var result = null;

                // NOTE: Before the page's <body> is processed and added to DOM,
                // some javascript frameworks create their own body element, perform
                // certain manipulations and then remove it.
                // Therefore, we need to check if the body element is present in DOM
                if (domUtils.isBodyElementWithChildren(this) && domUtils.isElementInDocument(this))
                    result = sandbox.shadowUI.insertBeforeRoot(child);
                else
                    result = nativeMethods.appendChild.call(this, child);

                sandbox._onElementAdded(child);

                return result;
            },

            removeChild (child) {
                if (domUtils.isDomElement(child)) {
                    domUtils.find(child, 'input[type=file]', ElementSandbox._removeFileInputInfo);

                    if (domUtils.isFileInput(child))
                        ElementSandbox._removeFileInputInfo(child);
                }

                var result = nativeMethods.removeChild.call(this, child);

                sandbox.onElementRemoved(child);

                return result;
            },

            replaceChild (newChild, oldChild) {
                if (newChild.nodeType === 3)
                    ElementSandbox._processTextNodeContent(newChild, this);

                return nativeMethods.replaceChild.call(this, newChild, oldChild);
            },

            cloneNode () {
                var clone = nativeMethods.cloneNode.apply(this, arguments);

                sandbox.nodeSandbox.overrideDomMethods(clone);

                return clone;
            },

            getAttribute (attr) {
                return sandbox._overridedGetAttributeCore(this, attr);
            },

            getAttributeNS (ns, attr) {
                return sandbox._overridedGetAttributeCore(this, attr, ns);
            },

            setAttribute (attr, value) {
                return sandbox._overridedSetAttributeCore(this, attr, value);
            },

            setAttributeNS (ns, attr, value) {
                return sandbox._overridedSetAttributeCore(this, attr, value, ns);
            },

            removeAttribute () {
                return sandbox._overridedRemoveAttributeCore(this, false, arguments);
            },

            removeAttributeNS () {
                return sandbox._overridedRemoveAttributeCore(this, true, arguments);
            },

            querySelector (selectors) {
                selectors = NodeSandbox.processSelector(selectors);

                var nativeQuerySelector = domUtils.isDocumentFragment(this) ? nativeMethods.documentFragmentQuerySelector
                    : nativeMethods.elementQuerySelector;

                return nativeQuerySelector.call(this, selectors);
            },

            querySelectorAll (selectors) {
                selectors = NodeSandbox.processSelector(selectors);

                var nativeQuerySelectorAll = domUtils.isDocumentFragment(this) ? nativeMethods.documentFragmentQuerySelectorAll
                    : nativeMethods.elementQuerySelectorAll;

                return nativeQuerySelectorAll.call(this, selectors);
            }
        };
    }

    static _processTextNodeContent (node, parentNode) {
        if (!parentNode.tagName)
            return;

        var parentTagName = parentNode.tagName.toLowerCase();

        if (parentTagName === 'script')
            node.data = processScript(node.data, true, false);
        else if (parentTagName === 'style')
            node.data = processStyle(node.data, urlUtils.getProxyUrl);
    }

    static _isUrlAttr (el, attr) {
        var tagName = el.tagName.toLowerCase();

        return domProcessor.URL_ATTR_TAGS[attr] && domProcessor.URL_ATTR_TAGS[attr].indexOf(tagName) !== -1;
    }

    static _isHrefAttrForBaseElement (el, attr) {
        return domUtils.isBaseElement(el) && attr === 'href';
    }

    static _removeFileInputInfo (el) {
        hiddenInfo.removeInputInfo(el);
    }

    _onElementAdded (el) {
        if ((el.nodeType === 1 || el.nodeType === 9) && domUtils.isElementInDocument(el)) {
            var iframes = ElementSandbox.getIframes(el);

            if (iframes.length) {
                for (var i = 0; i < iframes.length; i++)
                    this.onIframeAddedToDOM(iframes[i]);
            }
            else if (domUtils.isBodyElement(el))
                this.shadowUI.onBodyElementMutation();
        }

        if (domUtils.isDomElement(el)) {
            /* eslint-disable no-shadow */
            domUtils.find(el, 'input[type=file]', el => this.addFileInputInfo(el));
            /* eslint-enable no-shadow */

            if (domUtils.isFileInput(el))
                this.addFileInputInfo(el);

            else if (domUtils.isBaseElement(el)) {
                var storedHrefAttrName  = domProcessor.getStoredAttrName('href');
                var storedHrefAttrValue = el.getAttribute(storedHrefAttrName);

                urlResolver.updateBase(storedHrefAttrValue, this.document);
            }

        }
    }

    onElementRemoved (el) {
        if (domUtils.isBodyElement(el))
            this.shadowUI.onBodyElementMutation();

        else if (domUtils.isBaseElement(el))
            urlResolver.updateBase(getDestLocation(), this.document);
    }

    static getIframes (el) {
        var isIframe = el.tagName && el.tagName.toLowerCase() === 'iframe';

        return isIframe ? [el] : el.querySelectorAll('iframe');
    }

    addFileInputInfo (el) {
        var infoManager = this.uploadSandbox.infoManager;

        hiddenInfo.addInputInfo(el, infoManager.getFiles(el), infoManager.getValue(el));
    }

    onIframeAddedToDOM (iframe) {
        if (!domUtils.isCrossDomainIframe(iframe, true))
            this.nodeSandbox.mutation.onIframeAddedToDOM({ iframe });
    }

    attach (window) {
        super.attach(window);

        this._createOverridedMethods();

        window.Element.prototype.insertBefore              = this.overridedMethods.insertBefore;
        window.Element.prototype.appendChild               = this.overridedMethods.appendChild;
        window.Element.prototype.replaceChild              = this.overridedMethods.replaceChild;
        window.Element.prototype.removeChild               = this.overridedMethods.removeChild;
        window.Element.prototype.setAttribute              = this.overridedMethods.setAttribute;
        window.Element.prototype.setAttributeNS            = this.overridedMethods.setAttributeNS;
        window.Element.prototype.getAttribute              = this.overridedMethods.getAttribute;
        window.Element.prototype.getAttributeNS            = this.overridedMethods.getAttributeNS;
        window.Element.prototype.removeAttribute           = this.overridedMethods.removeAttribute;
        window.Element.prototype.removeAttributeNS         = this.overridedMethods.removeAttributeNS;
        window.Element.prototype.cloneNode                 = this.overridedMethods.cloneNode;
        window.Element.prototype.querySelector             = this.overridedMethods.querySelector;
        window.Element.prototype.querySelectorAll          = this.overridedMethods.querySelectorAll;
        window.Node.prototype.cloneNode                    = this.overridedMethods.cloneNode;
        window.Node.prototype.appendChild                  = this.overridedMethods.appendChild;
        window.Node.prototype.removeChild                  = this.overridedMethods.removeChild;
        window.Node.prototype.insertBefore                 = this.overridedMethods.insertBefore;
        window.Node.prototype.replaceChild                 = this.overridedMethods.replaceChild;
        window.DocumentFragment.prototype.querySelector    = this.overridedMethods.querySelector;
        window.DocumentFragment.prototype.querySelectorAll = this.overridedMethods.querySelectorAll;
        window.HTMLTableElement.prototype.insertRow        = this.overridedMethods.insertRow;
        window.HTMLTableSectionElement.prototype.insertRow = this.overridedMethods.insertRow;
        window.HTMLTableRowElement.prototype.insertCell    = this.overridedMethods.insertCell;
        window.HTMLFormElement.prototype.submit            = this.overridedMethods.formSubmit;
    }

    overrideElement (el) {
        var isDocFragment = domUtils.isDocumentFragment(el);
        var elTagName     = el.tagName && el.tagName.toLowerCase();
        var isForm        = elTagName === 'form';
        var isIframe      = elTagName === 'iframe';

        if (!isDocFragment)
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);

        if (elTagName === 'img') {
            el.addEventListener('error', e => {
                var storedAttr = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('src'));

                if (storedAttr && !urlUtils.parseProxyUrl(el.src) && urlUtils.isSupportedProtocol(el.src)) {
                    nativeMethods.setAttribute.call(el, 'src', urlUtils.getProxyUrl(storedAttr));
                    stopPropagation(e);
                }
            }, false);
        }

        if (isIframe && !domUtils.isCrossDomainIframe(el, true))
            this.iframeSandbox.overrideIframe(el);

        if ('insertAdjacentHTML' in el)
            el.insertAdjacentHTML = this.overridedMethods.insertAdjacentHTML;

        el.insertBefore = this.overridedMethods.insertBefore;
        el.appendChild  = this.overridedMethods.appendChild;
        el.replaceChild = this.overridedMethods.replaceChild;
        el.removeChild  = this.overridedMethods.removeChild;
        el.cloneNode    = this.overridedMethods.cloneNode;

        if (!isDocFragment) {
            el.setAttribute      = this.overridedMethods.setAttribute;
            el.setAttributeNS    = this.overridedMethods.setAttributeNS;
            el.getAttribute      = this.overridedMethods.getAttribute;
            el.getAttributeNS    = this.overridedMethods.getAttributeNS;
            el.removeAttribute   = this.overridedMethods.removeAttribute;
            el.removeAttributeNS = this.overridedMethods.removeAttributeNS;
        }

        if ('insertRow' in el)
            el.insertRow = this.overridedMethods.insertRow;

        if ('insertCell' in el)
            el.insertCell = this.overridedMethods.insertCell;

        if (isForm)
            el.submit = this.overridedMethods.formSubmit;
    }
}
