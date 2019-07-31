import url from 'url';
import pageProcessor from './page';
import manifestProcessor from './manifest';
import scriptProcessor from './script';
import stylesheetProcessor from './stylesheet';
import * as urlUtil from '../../utils/url';
import { encodeContent, decodeContent } from '../encoding';
import { platform } from 'os';

const IS_WIN: boolean = platform() === 'win32';
const DISK_RE: RegExp = /^[A-Za-z]:/;
const PROCESSORS      = [pageProcessor, manifestProcessor, scriptProcessor, stylesheetProcessor];

function getResourceUrlReplacer (ctx) {
    return function (resourceUrl: string, resourceType: string, charsetAttrValue, baseUrl: string) {
        if (!urlUtil.isSupportedProtocol(resourceUrl) && !urlUtil.isSpecialPage(resourceUrl))
            return resourceUrl;

        if (IS_WIN && ctx.dest.protocol === 'file:' && DISK_RE.test(resourceUrl))
            resourceUrl = '/' + resourceUrl;

        // NOTE: Resolves base URLs without a protocol ('//google.com/path' for example).
        baseUrl     = baseUrl ? url.resolve(ctx.dest.url, baseUrl) : '';
        resourceUrl = urlUtil.processSpecialChars(resourceUrl);

        let resolvedUrl = url.resolve(baseUrl || ctx.dest.url, resourceUrl);

        if (!urlUtil.isValidUrl(resolvedUrl))
            return resourceUrl;

        const isScript   = urlUtil.parseResourceType(resourceType).isScript;
        const charsetStr = charsetAttrValue || isScript && ctx.contentInfo.charset.get();

        resolvedUrl = urlUtil.ensureTrailingSlash(resourceUrl, resolvedUrl);

        if (!urlUtil.isValidUrl(resolvedUrl))
            return resolvedUrl;

        return ctx.toProxyUrl(resolvedUrl, false, resourceType, charsetStr);
    };
}

export async function process (ctx) {
    const body        = ctx.destResBody;
    const contentInfo = ctx.contentInfo;
    const encoding    = contentInfo.encoding;
    const charset     = contentInfo.charset;

    const decoded = await decodeContent(body, encoding, charset);

    for (const processor of PROCESSORS) {
        if (processor.shouldProcessResource(ctx)) {
            const urlReplacer = getResourceUrlReplacer(ctx);
            // @ts-ignore: Cannot invoke an expression whose type lacks a call signature
            const processed   = processor.processResource(decoded, ctx, charset, urlReplacer, false);

            if (processed === pageProcessor.RESTART_PROCESSING)
                return await process(ctx);

            return await encodeContent(processed, encoding, charset);
        }
    }

    return body;
}
