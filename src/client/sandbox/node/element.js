import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import domProcessor from '../../dom-processor/dom-processor';
import scriptProcessor from '../../../processing/script';
import urlUtils from '../../utils/url';
import * as domUtils from '../../utils/dom';
import * as hiddenInfo from '../upload/hidden-info';
import { stopPropagation } from '../../utils/event';
import { isPageHtml, processHtml } from '../../utils/html';
import { waitCookieMsg } from '../../transport';

export default class ElementSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.IFRAME_ADDED_EVENT = 'hammerhead|event|iframe-added';

        this.overridedMethods = null;
    }

    _overridedGetAttributeCore (el, attr, ns) {
        var getAttrMeth = ns ? nativeMethods.getAttributeNS : nativeMethods.getAttribute;

        // Optimization: hasAttribute meth is very slow
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
                                     scriptProcessor.process(valueWithoutProtocol, true);
                    /*eslint-enable no-script-url */
                }

                if (processedValue !== value) {
                    setAttrMeth.apply(el, ns ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
                    value = processedValue;
                }
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
                    var isCrossDomainUrl = isSupportedProtocol && !urlUtils.sameOriginCheck(location.toString(), value);
                    var resourceType     = null;
                    var elCharset        = isScript && el.charset;

                    if (isScript)
                        resourceType = urlUtils.SCRIPT;
                    else if (isIframe || domProcessor.isOpenLinkInIFrame(el))
                        resourceType = urlUtils.IFRAME;

                    value = isIframe && isCrossDomainUrl ? urlUtils.getCrossDomainIframeProxyUrl(value) :
                            urlUtils.getProxyUrl(value, null, null, null, resourceType, elCharset);
                }
            }
            else if (value && !urlUtils.parseProxyUrl(value))
                value = urlUtils.resolveUrlAsOrigin(value);

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

        if (attr !== 'autocomplete')
            return removeAttrFunc.apply(el, arg);
    }

    _createOverridedMethods () {
        var overrideNewElement           = el => this.sandbox.node.overrideDomMethods(el);
        var onElementAdded               = el => this._onElementAdded(el);
        var onElementRemoved             = el => this.onElementRemoved(el);
        var removeFileInputInfo          = el => ElementSandbox._removeFileInputInfo(el);
        var overridedGetAttributeCore    = (el, attr, ns) => this._overridedGetAttributeCore(el, attr, ns);
        var overridedSetAttributeCore    = (el, attr, value, ns) => this._overridedSetAttributeCore(el, attr, value, ns);
        var overridedRemoveAttributeCore = (el, ns, arg) => this._overridedRemoveAttributeCore(el, ns, arg);

        this.overridedMethods = {
            insertRow: function () {
                var tagName    = this.tagName.toLowerCase();
                var nativeMeth = tagName === 'table' ? nativeMethods.insertTableRow : nativeMethods.insertTBodyRow;
                var row        = nativeMeth.apply(this, arguments);

                overrideNewElement(row);

                return row;
            },

            insertCell () {
                var cell = nativeMethods.insertCell.apply(this, arguments);

                overrideNewElement(cell);

                return cell;
            },

            insertAdjacentHTML (pos, html) {
                if (html !== null)
                    html = processHtml('' + html, this.parentNode && this.parentNode.tagName);

                nativeMethods.insertAdjacentHTML.call(this, pos, html);
                overrideNewElement(this.parentNode || this);
            },

            formSubmit () {
                var form = this;

                waitCookieMsg(function () {
                    nativeMethods.formSubmit.apply(form, arguments);
                });
            },

            insertBefore (newNode, refNode) {
                overrideNewElement(newNode);

                var result = nativeMethods.insertBefore.call(this, newNode, refNode);

                onElementAdded(newNode);

                return result;
            },

            appendChild (child) {
                //NOTE: we should process a TextNode as a script if it is appended to a script element (B254284)
                if (child.nodeType === 3 && this.tagName && this.tagName.toLowerCase() === 'script')
                    child.data = scriptProcessor.process(child.data);

                overrideNewElement(child);

                var result = null;

                if (this.tagName && this.tagName.toLowerCase() === 'body' && this.children.length) {
                    // NOTE: We should to append element before shadow ui root
                    var lastChild = this.children[this.children.length - 1];

                    result = nativeMethods.insertBefore.call(this, child, lastChild);
                }
                else
                    result = nativeMethods.appendChild.call(this, child);

                onElementAdded(child);

                return result;
            },

            removeChild (child) {
                if (domUtils.isDomElement(child)) {
                    domUtils.find(child, 'input[type=file]', removeFileInputInfo);

                    if (domUtils.isFileInput(child))
                        removeFileInputInfo(child);
                }

                var result = nativeMethods.removeChild.call(this, child);

                onElementRemoved(child);

                return result;
            },

            cloneNode () {
                var clone = nativeMethods.cloneNode.apply(this, arguments);

                overrideNewElement(clone);

                return clone;
            },

            getAttribute (attr) {
                return overridedGetAttributeCore(this, attr);
            },

            getAttributeNS (ns, attr) {
                return overridedGetAttributeCore(this, attr, ns);
            },

            setAttribute (attr, value) {
                return overridedSetAttributeCore(this, attr, value);
            },

            setAttributeNS (ns, attr, value) {
                return overridedSetAttributeCore(this, attr, value, ns);
            },

            removeAttribute () {
                return overridedRemoveAttributeCore(this, false, arguments);
            },

            removeAttributeNS () {
                return overridedRemoveAttributeCore(this, true, arguments);
            }
        };
    }

    static _isUrlAttr (el, attr) {
        var tagName = el.tagName.toLowerCase();

        return domProcessor.URL_ATTR_TAGS[attr] && domProcessor.URL_ATTR_TAGS[attr].indexOf(tagName) !== -1;
    }

    static _removeFileInputInfo (el) {
        hiddenInfo.removeInputInfo(el);
    }

    _onElementAdded (el) {
        if ((el.nodeType === 1 || el.nodeType === 9) && domUtils.isElementInDocument(el)) {
            var iframes = ElementSandbox.getIframes(el);

            if (iframes.length) {
                for (var i = 0; i < iframes.length; i++)
                    this.onIFrameAddedToDOM(iframes[i]);
            }
            else if (el.tagName && el.tagName.toLowerCase() === 'body')
                this.sandbox.shadowUI.onBodyElementMutation();
        }

        if (domUtils.isDomElement(el)) {
            domUtils.find(el, 'input[type=file]', (el) => this.addFileInputInfo(el));

            if (domUtils.isFileInput(el))
                this.addFileInputInfo(el);
        }
    }

    onElementRemoved (el) {
        if (el.nodeType === 1 && el.tagName && el.tagName.toLowerCase() === 'body')
            this.sandbox.shadowUI.onBodyElementMutation();
    }

    static getIframes (el) {
        var isIframe = el.tagName && el.tagName.toLowerCase() === 'iframe';

        return isIframe ? [el] : el.querySelectorAll('iframe');
    }

    addFileInputInfo (el) {
        var infoManager = this.sandbox.upload.infoManager;

        hiddenInfo.addInputInfo(el, infoManager.getFiles(el), infoManager.getValue(el));
    }

    onIFrameAddedToDOM (iframe) {
        if (!domUtils.isCrossDomainIframe(iframe, true)) {
            this.emit(this.IFRAME_ADDED_EVENT, {
                iframe: iframe
            });

            this.sandbox.iframe.iframeAddedToDom(iframe);
        }
    }

    attach (window) {
        super.attach(window);

        this._createOverridedMethods();

        window.Element.prototype.insertBefore              = this.overridedMethods.insertBefore;
        window.Element.prototype.appendChild               = this.overridedMethods.appendChild;
        window.Element.prototype.removeChild               = this.overridedMethods.removeChild;
        window.Element.prototype.setAttribute              = this.overridedMethods.setAttribute;
        window.Element.prototype.setAttributeNS            = this.overridedMethods.setAttributeNS;
        window.Element.prototype.getAttribute              = this.overridedMethods.getAttribute;
        window.Element.prototype.getAttributeNS            = this.overridedMethods.getAttributeNS;
        window.Element.prototype.removeAttribute           = this.overridedMethods.removeAttribute;
        window.Element.prototype.removeAttributeNS         = this.overridedMethods.removeAttributeNS;
        window.Element.prototype.cloneNode                 = this.overridedMethods.cloneNode;
        window.Node.prototype.cloneNode                    = this.overridedMethods.cloneNode;
        window.Node.prototype.appendChild                  = this.overridedMethods.appendChild;
        window.Node.prototype.removeChild                  = this.overridedMethods.removeChild;
        window.Node.prototype.insertBefore                 = this.overridedMethods.insertBefore;
        window.HTMLTableElement.prototype.insertRow        = this.overridedMethods.insertRow;
        window.HTMLTableSectionElement.prototype.insertRow = this.overridedMethods.insertRow;
        window.HTMLTableRowElement.prototype.insertCell    = this.overridedMethods.insertCell;
        window.HTMLFormElement.prototype.submit            = this.overridedMethods.formSubmit;
    }

    overrideElement (el) {
        var isDocFragment = el.nodeType === 11;
        var elTagName     = el.tagName && el.tagName.toLowerCase();
        var isForm        = elTagName === 'form';
        var isIframe      = elTagName === 'iframe';

        if (!isDocFragment)
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);

        if (elTagName === 'img') {
            el.addEventListener('error', function (e) {
                var storedAttr = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('src'));

                if (storedAttr && !urlUtils.parseProxyUrl(el.src) && urlUtils.isSupportedProtocol(el.src)) {
                    nativeMethods.setAttribute.call(el, 'src', urlUtils.getProxyUrl(storedAttr));
                    stopPropagation(e);
                }
            }, false);
        }

        if (isIframe && !domUtils.isCrossDomainIframe(el, true))
            this.sandbox.iframe.overrideIframe(el);

        if ('insertAdjacentHTML' in el)
            el.insertAdjacentHTML = this.overridedMethods.insertAdjacentHTML;

        el.insertBefore = this.overridedMethods.insertBefore;
        el.appendChild  = this.overridedMethods.appendChild;
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
