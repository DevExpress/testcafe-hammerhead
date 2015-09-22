import CONST from '../../const';
import DomProcessor from '../dom';
import DomAdapter from '../dom/server-dom-adapter';
import ResourceProcessorBase from './resource-processor-base';
import whacko from 'whacko';
import dedent from 'dedent';
import scriptProcessor from '../script';

const BODY_CREATED_EVENT_SCRIPT = dedent`
    <script type="text/javascript" class="${ CONST.SHADOW_UI_SCRIPT_CLASSNAME }">
        if (window.Hammerhead)
            window.Hammerhead.sandbox.node.raiseBodyCreatedEvent();

        var script = document.currentScript || document.scripts[document.scripts.length - 1];
        script.parentNode.removeChild(script);
    </script>
`;

class PageProcessor extends ResourceProcessorBase {
    constructor () {
        super();

        this.RESTART_PROCESSING = Symbol();

        this.domProcessor = new DomProcessor(new DomAdapter());
    }

    static _getPageProcessingOptions (ctx, urlReplacer) {
        return {
            crossDomainProxyPort: ctx.serverInfo.crossDomainPort,
            isIFrame:             ctx.isIFrame,
            styleUrl:             ctx.getInjectableStyles()[0],
            scripts:              ctx.getInjectableScripts(),
            urlReplacer:          urlReplacer,
            isIframeWithImageSrc: ctx.contentInfo && ctx.contentInfo.isIFrameWithImageSrc
        };
    }

    _getPageMetas ($) {
        var metas = [];

        $('meta').each((index, meta) => {
            var $meta = $(meta);

            metas.push({
                httpEquiv: $meta.attr('http-equiv'),
                content:   $meta.attr('content'),
                charset:   $meta.attr('charset')
            });
        });

        return metas;
    }

    _addPageResources ($, processingOptions) {
        var resources = [];

        if (processingOptions.styleUrl) {
            resources.push(
                `<link rel="stylesheet" type="text/css" class="${CONST.SHADOW_UI_STYLESHEET_FULL_CLASSNAME}"` +
                `href="${processingOptions.styleUrl}">`
            );
        }

        if (processingOptions.scripts) {
            processingOptions.scripts.forEach(scriptUrl => {
                resources.push(
                    `<script type="text/javascript" class="${CONST.SHADOW_UI_SCRIPT_CLASSNAME}"` +
                    `charset="UTF-8" src="${scriptUrl}"></script>`
                );
            });
        }

        if (resources.length)
            $('head').prepend(resources.join(''));
    }

    static _addCharsetInfo ($, charset) {
        $($(`.${ CONST.SHADOW_UI_SCRIPT_CLASSNAME }`)[0])
            .before(`<meta class="${ CONST.SHADOW_UI_CHARSET_CLASSNAME }" charset="${charset}">`);
    }

    static _changeMetas ($) {
        // TODO: figure out how to emulate the behavior of the tag
        $('meta[name="referrer"][content="origin"]').remove();
        // NOTE: Remove existing compatible meta tag and add a new at the beginning of the head
        $('meta[http-equiv="X-UA-Compatible"]').remove();
        $('head').prepend('<meta http-equiv="X-UA-Compatible" content="IE=edge" />');
    }

    static _prepareHtml (html, processingOpts) {
        if (processingOpts && processingOpts.iframeImageSrc)
            return `<html><body><img src="${processingOpts.iframeImageSrc}" /></body></html>`;

        return html;
    }

    static _addBodyCreatedEventScript ($) {
        $('body').prepend(BODY_CREATED_EVENT_SCRIPT);
    }

    shouldProcessResource (ctx) {
        return ctx.isPage || ctx.contentInfo.isIFrameWithImageSrc;
    }

    processResource (html, ctx, charset, urlReplacer, processingOpts) {
        processingOpts = processingOpts || PageProcessor._getPageProcessingOptions(ctx, urlReplacer);

        var bom = scriptProcessor.getBOM(html);

        html = bom ? html.replace(bom, '') : html;

        PageProcessor._prepareHtml(html, processingOpts);

        var $ = whacko.load(html);

        if (charset.fromMeta(this._getPageMetas($)))
            return this.RESTART_PROCESSING;

        var pageProcessor = this;

        var iframeHtmlProcessor = function (iframeHtml, callback) {
            var storedIsIframe = processingOpts.isIFrame;

            processingOpts.isIFrame = true;

            var result = pageProcessor.processResource(iframeHtml, ctx, charset, urlReplacer, processingOpts);

            processingOpts.isIFrame = storedIsIframe;

            callback(result);
        };

        var domProcessor = new DomProcessor(new DomAdapter(processingOpts.isIFrame, processingOpts.crossDomainProxyPort));

        domProcessor.on(domProcessor.HTML_PROCESSING_REQUIRED_EVENT, iframeHtmlProcessor);
        domProcessor.processPage($, processingOpts.urlReplacer);
        domProcessor.off(domProcessor.HTML_PROCESSING_REQUIRED_EVENT, iframeHtmlProcessor);

        this._addPageResources($, processingOpts);
        PageProcessor._addBodyCreatedEventScript($);
        PageProcessor._changeMetas($);
        PageProcessor._addCharsetInfo($, charset.get());

        return (bom || '') + $.html();
    }
}

export default new PageProcessor();
