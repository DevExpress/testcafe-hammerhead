import nativeMethods from '../sandbox/native-methods';
import * as destLocation from '../utils/destination-location';
import { ensureTrailingSlash, parseUrl } from '../../utils/url';

const DOCUMENT_URL_RESOLVER = 'hammerhead|document-url-resolver';

export default {
    _createResolver (doc) {
        var htmlDocument = doc.implementation.createHTMLDocument('title');
        var a            = nativeMethods.createElement.call(htmlDocument, 'a');
        var base         = nativeMethods.createElement.call(htmlDocument, 'base');

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
            doc[DOCUMENT_URL_RESOLVER] = this._createResolver(doc);

        return doc[DOCUMENT_URL_RESOLVER];
    },

    init (doc) {
        this.updateBase(destLocation.get(), doc);
    },

    getResolverElement (doc) {
        return this._getResolver(doc).body.firstChild;
    },

    resolve (url, doc) {
        var resolver = this.getResolverElement(doc);

        if (url === null)
            nativeMethods.removeAttribute.call(resolver, 'href');
        else {
            resolver.href = url;

            // NOTE: It looks like a Chrome bug: in a nested iframe without src (when an iframe is placed into another
            // iframe) you cannot set a relative link href while the iframe loading is not completed. So, we'll do it with
            // the parent's urlResolver Safari demonstrates similar behavior, but urlResolver.href has a relative URL value.
            var needUseParentResolver = url && isIframeWithoutSrc && window.parent && window.parent.document &&
                                        (!resolver.href || resolver.href.indexOf('/') === 0);

            if (needUseParentResolver)
                return this.resolve(url, window.parent.document);
        }

        return ensureTrailingSlash(url, resolver.href);
    },

    updateBase (url, doc) {
        var resolverDocument = this._getResolver(doc);
        var baseElement      = nativeMethods.elementGetElementsByTagName.call(resolverDocument.head, 'base')[0];

        url = url || destLocation.get();

        var parsedUrl             = parseUrl(url);
        var isRelativeUrl         = !parsedUrl.host;
        var isProtocolRelativeUrl = /^\/\//.test(url) && !!parsedUrl.host;

        if (isRelativeUrl || isProtocolRelativeUrl) {
            var destinationLocation = destLocation.get();

            this.updateBase(destinationLocation, doc);
            url = this.resolve(url, doc);
        }

        nativeMethods.setAttribute.call(baseElement, 'href', url);
    },

    changeUrlPart (url, prop, value, doc) {
        var resolver  = this.getResolverElement(doc);

        resolver.href  = url;
        resolver[prop] = value;

        return resolver.href;
    }
};
