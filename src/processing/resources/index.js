import url from 'url';
import pageProcessor from './page';
import manifestProcessor from './manifest';
import scriptProcessor from './script';
import stylesheetProcessor from './stylesheet';
import * as urlUtil from '../../utils/url';
import { encodeContent, decodeContent } from '../encoding';
import { platform } from 'os';

const IS_WIN32 = platform() === 'win32';
const DISK_RE  = /^[A-Za-z]:/;

function getResourceUrlReplacer (ctx) {
    return function (resourceUrl, resourceType, charsetAttrValue, baseUrl) {
        if (!urlUtil.isSupportedProtocol(resourceUrl) && !urlUtil.isSpecialPage(resourceUrl))
            return resourceUrl;

        if (IS_WIN32 && ctx.dest.protocol === 'file:' && DISK_RE.test(resourceUrl))
            resourceUrl = '/' + resourceUrl;

        // NOTE: Resolves base URLs without a protocol ('//google.com/path' for example).
        baseUrl     = baseUrl ? url.resolve(ctx.dest.url, baseUrl) : '';
        resourceUrl = urlUtil.prepareUrl(resourceUrl);

        var resolvedUrl = url.resolve(baseUrl || ctx.dest.url, resourceUrl);
        var isScript    = urlUtil.parseResourceType(resourceType).isScript;
        var charsetStr  = charsetAttrValue || isScript && ctx.contentInfo.charset.get();

        resolvedUrl = urlUtil.ensureTrailingSlash(resourceUrl, resolvedUrl);

        if (!urlUtil.isValidUrl(resolvedUrl))
            return resolvedUrl;

        return ctx.toProxyUrl(resolvedUrl, false, resourceType, charsetStr);
    };
}

export async function process (ctx) {
    var processors  = [pageProcessor, manifestProcessor, scriptProcessor, stylesheetProcessor];
    var body        = ctx.destResBody;
    var contentInfo = ctx.contentInfo;
    var encoding    = contentInfo.encoding;
    var charset     = contentInfo.charset;

    var decoded = await decodeContent(body, encoding, charset);

    for (var i = 0; i < processors.length; i++) {
        if (processors[i].shouldProcessResource(ctx)) {
            var urlReplacer = getResourceUrlReplacer(ctx);
            var processed   = processors[i].processResource(decoded, ctx, charset, urlReplacer);

            if (processed === pageProcessor.RESTART_PROCESSING)
                return await process(ctx);

            return await encodeContent(processed, encoding, charset);
        }
    }

    return body;
}
