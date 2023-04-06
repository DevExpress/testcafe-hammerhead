import nativeMethods from '../sandbox/native-methods';
import * as destLocation from '../utils/destination-location';
import { ensureTrailingSlash, parseUrl } from '../../utils/url';
import { isIframeWithoutSrc, getFrameElement } from './dom';

const DOCUMENT_URL_RESOLVER = 'hammerhead|document-url-resolver';

export default {
    _createResolver (doc: Document) {
        const htmlDocument = nativeMethods.createHTMLDocument.call(doc.implementation, 'title');
        const a            = nativeMethods.createElement.call(htmlDocument, 'a');
        const base         = nativeMethods.createElement.call(htmlDocument, 'base');

        nativeMethods.appendChild.call(htmlDocument.body, a);
        nativeMethods.appendChild.call(htmlDocument.head, base);

        return htmlDocument;
    },

    _getResolver (doc: Document) {
        // NOTE: Once a document is recreated (document.open, document.write is called), nativeMethods will be refreshed.
        // If we call urlResolve.updateBase after this,
        // we will use native methods from an actual document.
        // However, a document that contains an element for url resolving is created using a previous version of nativeMethods.
        if (!doc[DOCUMENT_URL_RESOLVER]) {
            nativeMethods.objectDefineProperty(doc, DOCUMENT_URL_RESOLVER, {
                value:    this._createResolver(doc),
                writable: true,
            });
        }

        return doc[DOCUMENT_URL_RESOLVER];
    },

    _isNestedIframeWithoutSrc (win: Window) {
        if (!win || !win.parent || win.parent === win || win.parent.parent === win.parent)
            return false;

        const iframeElement = getFrameElement(window);

        return !!iframeElement && isIframeWithoutSrc(iframeElement);
    },

    init (doc: Document) {
        this.updateBase(destLocation.get(), doc);
    },

    getResolverElement (doc: Document) {
        return nativeMethods.nodeFirstChildGetter.call(this._getResolver(doc).body);
    },

    resolve (url: string, doc: Document) {
        const resolver = this.getResolverElement(doc);
        let href       = null;

        if (url === null)
            nativeMethods.removeAttribute.call(resolver, 'href');
        else {
            nativeMethods.anchorHrefSetter.call(resolver, url);

            href = nativeMethods.anchorHrefGetter.call(resolver);

            // NOTE: It looks like a Chrome bug: in a nested iframe without src (when an iframe is placed into another
            // iframe) you cannot set a relative link href while the iframe loading is not completed. So, we'll do it with
            // the parent's urlResolver Safari demonstrates similar behavior, but urlResolver.href has a relative URL value.
            const needUseParentResolver = url && (!href || href.charAt(0) === '/') &&
                                          this._isNestedIframeWithoutSrc(doc.defaultView);

            if (needUseParentResolver)
                return this.resolve(url, window.parent.document);
        }

        return ensureTrailingSlash(url, href);
    },

    updateBase (url: string, doc: Document) {
        if (this.nativeAutomation)
            return;

        const resolverDocument = this._getResolver(doc);
        const baseElement      = nativeMethods.elementGetElementsByTagName.call(resolverDocument.head, 'base')[0];

        url = url || destLocation.get();

        /*eslint-disable no-restricted-properties*/
        const parsedUrl             = parseUrl(url);
        const isRelativeUrl         = parsedUrl.protocol !== 'file:' && parsedUrl.protocol !== 'about:' && !parsedUrl.host;
        const isProtocolRelativeUrl = /^\/\//.test(url) && !!parsedUrl.host;
        /*eslint-enable no-restricted-properties*/

        if (isRelativeUrl || isProtocolRelativeUrl) {
            const destinationLocation = destLocation.get();

            this.updateBase(destinationLocation, doc);
            url = this.resolve(url, doc);
        }

        nativeMethods.setAttribute.call(baseElement, 'href', url);
    },

    getBaseUrl (doc) {
        const baseElement = nativeMethods.elementGetElementsByTagName.call(this._getResolver(doc).head, 'base')[0];

        return nativeMethods.getAttribute.call(baseElement, 'href');
    },

    changeUrlPart (url, nativePropSetter, value, doc) {
        const resolver = this.getResolverElement(doc);

        nativeMethods.anchorHrefSetter.call(resolver, url);
        nativePropSetter.call(resolver, value);

        return nativeMethods.anchorHrefGetter.call(resolver);
    },

    dispose (doc) {
        doc[DOCUMENT_URL_RESOLVER] = null;
    },

    get nativeAutomation () {
        return this._nativeAutomation;
    },

    set nativeAutomation (value: boolean) {
        this._nativeAutomation = value;
    },
};
