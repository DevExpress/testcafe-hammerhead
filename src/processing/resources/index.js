import url from 'url';
import pageProcessor from './page';
import manifestProcessor from './manifest';
import scriptProcessor from './script';
import stylesheetProcessor from './stylesheet';
import * as urlUtil from '../../utils/url';
import { encodeContent, decodeContent } from '../encoding';
import { ensureTrailingSlash } from '../../utils/url';

function getResourceUrlReplacer (ctx) {
    return function (resourceUrl, resourceType, charsetAttrValue, baseUrl) {
        // NOTE: Resolves base URLs without a protocol ('//google.com/path' for example).
        baseUrl     = baseUrl ? url.resolve(ctx.dest.url, baseUrl) : '';
        resourceUrl = urlUtil.prepareUrl(resourceUrl);

        var resolvedUrl = url.resolve(baseUrl || ctx.dest.url, resourceUrl);
        var charsetStr  = charsetAttrValue || resourceType === urlUtil.SCRIPT && ctx.contentInfo.charset.get();

        resolvedUrl = ensureTrailingSlash(resourceUrl, resolvedUrl);

        try {
            return ctx.toProxyUrl(resolvedUrl, false, resourceType, charsetStr);
        }
        catch (err) {
            return resourceUrl;
        }
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
