import XHR_HEADERS from './xhr/headers';
import Charset from '../processing/encoding/charset';
import * as urlUtils from '../utils/url';
import * as contentTypeUtils from '../utils/content-type';
import genearateUniqueId from '../utils/generate-unique-id';

const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];

export default class RequestPipelineContext {
    constructor (req, res, serverInfo) {
        this.serverInfo = serverInfo;
        this.session    = null;

        this.req     = req;
        this.reqBody = null;
        this.res     = res;

        this.dest          = null;
        this.destRes       = null;
        this.destResBody   = null;
        this.hasDestReqErr = false;

        this.isXhr         = false;
        this.isFetch       = false;
        this.isPage        = false;
        this.isHtmlImport  = false;
        this.isWebSocket   = false;
        this.isIframe      = false;
        this.isSpecialPage = false;
        this.contentInfo   = null;

        const acceptHeader = req.headers['accept'];

        this.isXhr   = !!req.headers[XHR_HEADERS.requestMarker];
        this.isFetch = !!req.headers[XHR_HEADERS.fetchRequestCredentials];
        this.isPage  = !this.isXhr && !this.isFetch && acceptHeader && contentTypeUtils.isPage(acceptHeader);

        this.restoringStorages = null;

        this.requestId                      = genearateUniqueId();
        this.requestFilterRules             = [];
        this.onResponseEventDataWithoutBody = [];

        this.reqOpts = null;
    }

    // TODO: Rewrite parseProxyUrl instead.
    _flattenParsedProxyUrl (parsed) {
        if (parsed) {
            const parsedResourceType = urlUtils.parseResourceType(parsed.resourceType);

            const dest = {
                url:           parsed.destUrl,
                protocol:      parsed.destResourceInfo.protocol,
                host:          parsed.destResourceInfo.host,
                hostname:      parsed.destResourceInfo.hostname,
                port:          parsed.destResourceInfo.port,
                partAfterHost: parsed.destResourceInfo.partAfterHost,
                isIframe:      parsedResourceType.isIframe,
                isForm:        parsedResourceType.isForm,
                isScript:      parsedResourceType.isScript,
                isEventSource: parsedResourceType.isEventSource,
                isHtmlImport:  parsedResourceType.isHtmlImport,
                isWebSocket:   parsedResourceType.isWebSocket,
                charset:       parsed.charset,
                reqOrigin:     parsed.reqOrigin
            };

            return {
                dest:      dest,
                sessionId: parsed.sessionId
            };
        }

        return null;
    }

    _getDestFromReferer (parsedReferer) {
        const dest = parsedReferer.dest;

        dest.partAfterHost = this.req.url;
        dest.url           = urlUtils.formatUrl(dest);

        return {
            dest:      dest,
            sessionId: parsedReferer.sessionId
        };
    }

    _isFileDownload () {
        const contentDisposition = this.destRes.headers['content-disposition'];

        return contentDisposition &&
               contentDisposition.indexOf('attachment') > -1 &&
               contentDisposition.indexOf('filename') > -1;
    }

    _getInjectable (injectable) {
        return injectable.map(url => this.serverInfo.domain + url);
    }

    _initRequestNatureInfo () {
        const acceptHeader = this.req.headers['accept'];

        this.isXhr          = !!this.req.headers[XHR_HEADERS.requestMarker];
        this.isPage         = !this.isXhr && acceptHeader && contentTypeUtils.isPage(acceptHeader) ||
                              this.dest.isHtmlImport;
        this.isHtmlImport   = this.dest.isHtmlImport;
        this.isWebSocket    = this.dest.isWebSocket;
        this.isIframe       = this.dest.isIframe;
        this.isSpecialPage  = urlUtils.isSpecialPage(this.dest.url);
        this.isFileProtocol = this.dest.protocol === 'file:';
    }

    // API
    dispatch (openSessions) {
        let parsedReqUrl  = urlUtils.parseProxyUrl(this.req.url);
        const referer     = this.req.headers['referer'];
        let parsedReferer = referer && urlUtils.parseProxyUrl(referer);

        // TODO: Remove it after parseProxyURL is rewritten.
        parsedReqUrl  = this._flattenParsedProxyUrl(parsedReqUrl);
        parsedReferer = this._flattenParsedProxyUrl(parsedReferer);

        // NOTE: Try to extract the destination from the 'referer' header.
        if (!parsedReqUrl && parsedReferer)
            parsedReqUrl = this._getDestFromReferer(parsedReferer);

        if (parsedReqUrl) {
            this.session = openSessions[parsedReqUrl.sessionId];

            if (!this.session)
                return false;

            this.dest = parsedReqUrl.dest;

            // Browsers add a leading slash to the pathname part of url (GH-608)
            // For example: url http://www.example.com?gd=GID12082014 will be converted
            // to http://www.example.com/?gd=GID12082014
            this.dest.partAfterHost = (this.dest.partAfterHost[0] === '/' ? '' : '/') + this.dest.partAfterHost;

            this.dest.domain = urlUtils.getDomain(this.dest);

            if (parsedReferer) {
                this.dest.referer   = parsedReferer.dest.url;
                this.dest.reqOrigin = parsedReferer.dest.protocol === 'file:'
                    ? parsedReferer.dest.url
                    : urlUtils.getDomain(parsedReferer.dest);
            }
            else if (this.req.headers[XHR_HEADERS.origin])
                this.dest.reqOrigin = this.req.headers[XHR_HEADERS.origin];

            this._initRequestNatureInfo();

            return true;
        }

        return false;
    }

    buildContentInfo () {
        const contentType = this.destRes.headers['content-type'] || '';
        const accept      = this.req.headers['accept'] || '';
        const encoding    = this.destRes.headers['content-encoding'];

        if (this.isPage && contentType)
            this.isPage = !this.isXhr && !this.isFetch && contentTypeUtils.isPage(contentType);

        const isCSS                   = contentTypeUtils.isCSSResource(contentType, accept);
        const isManifest              = contentTypeUtils.isManifest(contentType);
        const isScript                = this.dest.isScript || contentTypeUtils.isScriptResource(contentType, accept);
        const isForm                  = this.dest.isForm;
        const isFormWithEmptyResponse = isForm && this.destRes.statusCode === 204;

        const isRedirect              = this.destRes.headers['location'] &&
                                        REDIRECT_STATUS_CODES.indexOf(this.destRes.statusCode) > -1;
        const requireAssetsProcessing = (isCSS || isScript || isManifest) && this.destRes.statusCode !== 204;
        const isNotModified           = this.req.method === 'GET' && this.destRes.statusCode === 304 &&
                                        (this.req.headers['if-modified-since'] || this.req.headers['if-none-match']);
        const requireProcessing       = !this.isXhr && !this.isFetch && !isFormWithEmptyResponse && !isRedirect &&
                                        !isNotModified && (this.isPage || this.isIframe || requireAssetsProcessing);
        const isFileDownload          = this._isFileDownload() && !this.dest.isScript;
        const isIframeWithImageSrc    = this.isIframe && !this.isPage && /^\s*image\//.test(contentType);

        let charset               = null;
        const contentTypeUrlToken = urlUtils.getResourceTypeString({
            isIframe: this.isIframe,
            isForm:   isForm,
            isScript: isScript
        });

        // NOTE: We need charset information if we are going to process the resource.
        if (requireProcessing) {
            charset = new Charset();

            if (!charset.fromContentType(contentType))
                charset.fromUrl(this.dest.charset);
        }

        if (isFileDownload)
            this.session.handleFileDownload();

        this.contentInfo = {
            charset,
            requireProcessing,
            isIframeWithImageSrc,
            isCSS,
            isScript,
            isManifest,
            encoding,
            contentTypeUrlToken,
            isFileDownload,
            isNotModified,
            isRedirect
        };
    }

    getInjectableScripts () {
        const taskScript = this.isIframe ? '/iframe-task.js' : '/task.js';
        const scripts    = this.session.injectable.scripts.concat(taskScript);

        return this._getInjectable(scripts);
    }

    getInjectableStyles () {
        return this._getInjectable(this.session.injectable.styles);
    }

    redirect (url) {
        this.res.statusCode = 302;
        this.res.setHeader('location', url);
        this.res.end();
    }

    saveNonProcessedDestResBody (value) {
        this.nonProcessedDestResBody = value;
    }

    closeWithError (statusCode, resBody) {
        this.res.statusCode = statusCode;

        if (resBody && !this.res.headersSent && this.res.setHeader) {
            this.res.setHeader('content-type', 'text/html');
            this.res.end(resBody);
        }
        else
            this.res.end();
    }

    toProxyUrl (url, isCrossDomain, resourceType, charset) {
        const proxyHostname = this.serverInfo.hostname;
        const proxyProtocol = this.serverInfo.protocol;
        const proxyPort     = isCrossDomain ? this.serverInfo.crossDomainPort : this.serverInfo.port;
        const sessionId     = this.session.id;

        return urlUtils.getProxyUrl(url, {
            proxyHostname,
            proxyProtocol,
            proxyPort,
            sessionId,
            resourceType,
            charset
        });
    }
}
