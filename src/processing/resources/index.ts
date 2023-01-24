import url from 'url';
import pageProcessor from './page';
import manifestProcessor from './manifest';
import scriptProcessor from './script';
import stylesheetProcessor from './stylesheet';
import * as urlUtil from '../../utils/url';
import { encodeContent, decodeContent } from '../encoding';
import { platform } from 'os';
import RequestPipelineContext from '../../request-pipeline/context';

const IS_WIN: boolean     = platform() === 'win32';
const DISK_RE     = /^[A-Za-z]:/;
const RESOURCE_PROCESSORS = [pageProcessor, manifestProcessor, scriptProcessor, stylesheetProcessor];

function getResourceUrlReplacer (ctx: RequestPipelineContext): Function {
    return function urlReplacer (resourceUrl: string, resourceType: string, charsetAttrValue: string, baseUrl: string, isCrossDomain = false, isUrlsSet = false) {
        if (isUrlsSet)
            return urlUtil.handleUrlsSet(urlReplacer, resourceUrl, resourceType, charsetAttrValue, baseUrl, isCrossDomain);

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

        // NOTE: Script or <link rel='preload' as='script'>
        const isScriptLike = urlUtil.parseResourceType(resourceType).isScript;
        const charsetStr   = charsetAttrValue || isScriptLike && ctx.contentInfo.charset.get();

        resolvedUrl = urlUtil.ensureTrailingSlash(resourceUrl, resolvedUrl);

        if (!urlUtil.isValidUrl(resolvedUrl))
            return resolvedUrl;

        return ctx.toProxyUrl(resolvedUrl, isCrossDomain, resourceType, charsetStr as string);
    };
}

export async function process (ctx: RequestPipelineContext): Promise<Buffer> {
    const { destResBody, contentInfo } = ctx;
    const { encoding, charset }        = contentInfo;

    const decoded = await decodeContent(destResBody, encoding, charset);

    for (const processor of RESOURCE_PROCESSORS) {
        if (!processor.shouldProcessResource(ctx))
            continue;

        const urlReplacer = getResourceUrlReplacer(ctx);

        if (pageProcessor === processor)
            await ctx.prepareInjectableUserScripts(ctx.eventFactory, ctx.session.injectable.userScripts);

        // @ts-ignore: Cannot invoke an expression whose type lacks a call signature
        const processed   = processor.processResource(decoded, ctx, charset, urlReplacer);

        if (processed === pageProcessor.RESTART_PROCESSING)
            return await process(ctx);

        return await encodeContent(processed as string, encoding, charset);
    }

    return destResBody;
}
