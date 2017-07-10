import nativeMethods from '../sandbox/native-methods';
import * as destLocation from '../utils/destination-location';
import { ensureTrailingSlash, parseUrl } from '../../utils/url';

const DOCUMENT_URL_RESOLVER = 'hammerhead|document-url-resolver';

export default {
    _createResolver (doc) {
        const htmlDocument = doc.implementation.createHTMLDocument('title');
        const a            = nativeMethods.createElement.call(htmlDocument, 'a');
        const base         = nativeMethods.createElement.call(htmlDocument, 'base');

        nativeMethods.appendChild.call(htmlDocument.body, a);
        nativeMethods.appendChild.call(htmlDocument.head, base);

        return htmlDocument;
    },

    _getResolver (doc) {
        // NOTE: Once a document is recreated (document.open, document.write is called), nativeMethods will be refreshed.
        // If we call urlResolve.updateBase after this,
        // we will use native methods from an actual document.
        // However, a document that contains an element for url resolving is created using a previous version of nativeMethods.
        if (!doc[DOCUMENT_URL_RESOLVER])
            Object.defineProperty(doc, DOCUMENT_URL_RESOLVER, { value: this._createResolver(doc), writable: true });

        return doc[DOCUMENT_URL_RESOLVER];
    },

    init (doc) {
        this.updateBase(destLocation.get(), doc);
    },

    getResolverElement (doc) {
        return this._getResolver(doc).body.firstChild;
    },

    resolve (url, doc) {
        const resolver = this.getResolverElement(doc);

        if (url === null)
            nativeMethods.removeAttribute.call(resolver, 'href');
        else {
            resolver.href = url;

            // NOTE: It looks like a Chrome bug: in a nested iframe without src (when an iframe is placed into another
            // iframe) you cannot set a relative link href while the iframe loading is not completed. So, we'll do it with
            // the parent's urlResolver Safari demonstrates similar behavior, but urlResolver.href has a relative URL value.
            const needUseParentResolver = url && isIframeWithoutSrc && window.parent && window.parent.document &&
                                        (!resolver.href || resolver.href.indexOf('/') === 0);

            if (needUseParentResolver)
                return this.resolve(url, window.parent.document);
        }

        return ensureTrailingSlash(url, resolver.href);
    },

    updateBase (url, doc) {
        const resolverDocument = this._getResolver(doc);
        const baseElement      = nativeMethods.elementGetElementsByTagName.call(resolverDocument.head, 'base')[0];

        url = url || destLocation.get();

        const parsedUrl             = parseUrl(url);
        const isRelativeUrl         = parsedUrl.protocol !== 'file:' && !parsedUrl.host;
        const isProtocolRelativeUrl = /^\/\//.test(url) && !!parsedUrl.host;

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

    changeUrlPart (url, prop, value, doc) {
        const resolver = this.getResolverElement(doc);

        resolver.href  = url;
        resolver[prop] = value;

        return resolver.href;
    }
};
