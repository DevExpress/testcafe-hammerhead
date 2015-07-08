import DomProcessor from '../dom';
import DomAdapter from '../dom/adapter-server';
import * as Const from '../../const';
import * as contentUtils from '../../utils/content';
import whacko from 'whacko';
import ResourceProcessorBase from './resource-processor-base';
import scriptProcessor from '../script';

const BODY_CREATED_EVENT_SCRIPT =
          `<script type="text/javascript" class="${Const.SHADOW_UI_SCRIPT_CLASSNAME}">
        if (window.Hammerhead)
           window.Hammerhead._raiseBodyCreatedEvent();
        var script = document.currentScript || document.scripts[document.scripts.length - 1];
        script.parentNode.removeChild(script);
    </script>`;

class PageProcessor extends ResourceProcessorBase {
    constructor () {
        super();

        this.domProcessor = new DomProcessor(new DomAdapter());
    }

    _getPageProcessingOptions (ctx, urlReplacer) {
        return {
            crossDomainProxyPort: ctx.serverInfo.crossDomainPort,
            isIFrame:             ctx.isIFrame,
            styleUrl:             ctx.getInjectableStyles()[0],
            scripts:              ctx.getInjectableScripts(),
            urlReplacer:          urlReplacer,
            isIframeWithImageSrc: ctx.contentInfo && ctx.contentInfo.isIFrameWithImageSrc
        };
    }

    _getRightCharset ($, defaultCharset, actualCharset) {
        if (!defaultCharset) {
            // NOTE: if the charset doesn't set in server's header and if the charset sets in page's meta tag
            // and isn't equal to the default charset, we restart processing with the new charset.
            // We returns null if need to restart procession.
            var pageCharset = this._getPageCharset($);

            if (pageCharset && pageCharset !== actualCharset)
                return pageCharset;
        }

        return '';
    }

    _getPageCharset ($) {
        var metas = [];

        $('meta').each(function (meta) {
            var $meta = $(meta);

            metas.push({
                httpEquiv: $meta.attr('http-equiv'),
                content:   $meta.attr('content'),
                charset:   $meta.attr('charset')
            });
        });

        return contentUtils.parseCharsetFromMeta(metas);
    }

    _addPageResources ($, processingOptions) {
        var resources = [];

        if (processingOptions.styleUrl) {
            resources.push('<link rel="stylesheet" type="text/css" class="');
            resources.push(Const.SHADOW_UI_STYLESHEET_FULL_CLASSNAME);
            resources.push('"href = "');
            resources.push(processingOptions.styleUrl);
            resources.push('">');
        }

        if (processingOptions.scripts) {
            processingOptions.scripts.forEach(function (scriptUrl) {
                resources.push('<script type="text/javascript" class="');
                resources.push(Const.SHADOW_UI_SCRIPT_CLASSNAME);
                resources.push('" charset="UTF-8" src="');
                resources.push(scriptUrl);
                resources.push('">');
                resources.push('</script>');
            });
        }

        if (resources.length)
            $('head').prepend(resources.join(''));
    }

    _changeMetas ($) {
        // TODO: figure out how to emulate the behavior of the tag
        $('meta[name="referrer"][content="origin"]').remove();
        // NOTE: Remove existing compatible meta tag and add a new at the beginning of the head
        $('meta[http-equiv="X-UA-Compatible"]').remove();
        $('head').prepend('<meta http-equiv="X-UA-Compatible" content="IE=edge" />');
    }

    _prepareHtml (html, processingOpts) {
        if (processingOpts && processingOpts.iframeImageSrc)
            return '<html><body><img src="' + processingOpts.iframeImageSrc + '" /></body></html>';

        return html;
    }

    _addBodyCreatedEventScript ($) {
        $('body').prepend(BODY_CREATED_EVENT_SCRIPT);
    }

    shouldProcessResource (ctx) {
        return ctx.isPage || ctx.contentInfo.isIFrameWithImageSrc;
    }

    processResource (html, ctx, actualCharset, urlReplacer, processingOpts) {
        processingOpts = processingOpts || this._getPageProcessingOptions(ctx, urlReplacer);

        var defaultCharset = ctx.contentInfo.charset;

        var bom = scriptProcessor.getBOM(html);

        html = bom ? html.replace(bom, '') : html;

        this._prepareHtml(html, processingOpts);

        var $ = whacko.load(html);

        actualCharset = actualCharset || defaultCharset;

        var rightCharset = this._getRightCharset($, defaultCharset, actualCharset);

        // Restart processing with page charset
        if (rightCharset)
            this.processResource(html, ctx, rightCharset, urlReplacer, processingOpts); // TODO: investigate and fix
        else {
            var pageProcessor = this;

            var iframeHtmlProcessor = function (iframeHtml, callback) {
                var storedIsIframe = processingOpts.isIFrame;

                processingOpts.isIFrame = true;

                var result = pageProcessor.processResource(iframeHtml, ctx, actualCharset, urlReplacer, processingOpts);

                processingOpts.isIFrame = storedIsIframe;

                callback(result);
            };

            var domProcessor = new DomProcessor(new DomAdapter(processingOpts.isIFrame, processingOpts.crossDomainProxyPort));

            domProcessor.on(domProcessor.HTML_PROCESSING_REQUIRED, iframeHtmlProcessor);
            domProcessor.processPage($, processingOpts.urlReplacer);
            domProcessor.off(domProcessor.HTML_PROCESSING_REQUIRED, iframeHtmlProcessor);

            this._addPageResources($, processingOpts);
            this._addBodyCreatedEventScript($);
            this._changeMetas($);

            return (bom || '') + $.html();
        }
    }
}

export default new PageProcessor();
