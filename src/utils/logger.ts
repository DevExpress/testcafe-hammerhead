import debug from 'debug';
import RequestPipelineContext from '../request-pipeline/context';

debug.formatters.i = (ctx: RequestPipelineContext): string => {
    const stringifiedInfoArr: string[] = [];
    const contentInfo = ctx.contentInfo;

    if (ctx.isPage)
        stringifiedInfoArr.push('isPage');

    if (ctx.isIframe)
        stringifiedInfoArr.push('isIframe');

    if (ctx.isAjax)
        stringifiedInfoArr.push('isAjax');

    if (ctx.isWebSocket)
        stringifiedInfoArr.push('isWebSocket');

    if (contentInfo && contentInfo.isCSS)
        stringifiedInfoArr.push('isCSS');

    if (contentInfo && contentInfo.isScript)
        stringifiedInfoArr.push('isScript');

    if (contentInfo && contentInfo.isManifest)
        stringifiedInfoArr.push('isManifest');

    if (contentInfo && contentInfo.isFileDownload)
        stringifiedInfoArr.push('isFileDownload');

    if (ctx.contentInfo && ctx.contentInfo.isNotModified)
        stringifiedInfoArr.push('isNotModified');

    if (contentInfo && contentInfo.isRedirect)
        stringifiedInfoArr.push('isRedirect');

    if (contentInfo && contentInfo.isIframeWithImageSrc)
        stringifiedInfoArr.push('isIframeWithImageSrc');

    if (contentInfo && contentInfo.charset)
        stringifiedInfoArr.push('charset: ' + contentInfo.charset.get());

    if (contentInfo) {
        stringifiedInfoArr.push('encoding: ' + contentInfo.encoding);
        stringifiedInfoArr.push('requireProcessing: ' + contentInfo.requireProcessing);
    }

    return `{ ${stringifiedInfoArr.join(', ')} }`;
};

const hammerhead        = debug('hammerhead');
const proxy             = hammerhead.extend('proxy');
const destination       = hammerhead.extend('destination');
const destinationSocket = destination.extend('socket');
const serviceMsg        = hammerhead.extend('service-message');

export default { proxy, destination, destinationSocket, serviceMsg };
