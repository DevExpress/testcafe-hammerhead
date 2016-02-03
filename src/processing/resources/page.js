import parse5 from 'parse5';
import dedent from 'dedent';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import DomProcessor from '../dom';
import DomAdapter from '../dom/parse5-dom-adapter';
import ResourceProcessorBase from './resource-processor-base';
import * as parse5Utils from '../../utils/parse5';
import getBOM from '../../utils/get-bom';

const BODY_CREATED_EVENT_SCRIPT = dedent(`
    <script type="text/javascript" class="${ SHADOW_UI_CLASSNAME.script }">
        if (window["%hammerhead%"])
            window["%hammerhead%"].sandbox.node.raiseBodyCreatedEvent();

        var script = document.currentScript || document.scripts[document.scripts.length - 1];
        script.parentNode.removeChild(script);
    </script>
`);

class PageProcessor extends ResourceProcessorBase {
    constructor () {
        super();

        this.parser = new parse5.Parser();

        this.RESTART_PROCESSING               = Symbol();
        this.PARSED_BODY_CREATED_EVENT_SCRIPT = this.parser.parseFragment(BODY_CREATED_EVENT_SCRIPT).childNodes[0];


        this.serializer = new parse5.Serializer();
    }

    static _getPageProcessingOptions (ctx, urlReplacer) {
        return {
            crossDomainProxyPort: ctx.serverInfo.crossDomainPort,
            isIframe:             ctx.isIframe,
            stylesheets:          ctx.getInjectableStyles(),
            scripts:              ctx.getInjectableScripts(),
            urlReplacer:          urlReplacer,
            isIframeWithImageSrc: ctx.contentInfo && ctx.contentInfo.isIframeWithImageSrc
        };
    }

    static _getPageMetas (metaEls, domAdapter) {
        var metas = [];

        for (var i = 0; i < metaEls.length; i++) {
            metas.push({
                httpEquiv: domAdapter.getAttr(metaEls[i], 'http-equiv'),
                content:   domAdapter.getAttr(metaEls[i], 'content'),
                charset:   domAdapter.getAttr(metaEls[i], 'charset')
            });
        }

        return metas;
    }

    static _addPageResources (head, processingOptions) {
        var result = [];

        if (processingOptions.stylesheets) {
            processingOptions.stylesheets.forEach(stylesheetUrl => {
                result.push(parse5Utils.createElement('link', [
                    { name: 'rel', value: 'stylesheet' },
                    { name: 'type', value: 'text/css' },
                    { name: 'class', value: SHADOW_UI_CLASSNAME.uiStylesheet },
                    { name: 'href', value: stylesheetUrl }
                ]));
            });

        }

        if (processingOptions.scripts) {
            processingOptions.scripts.forEach(scriptUrl => {
                result.push(parse5Utils.createElement('script', [
                    { name: 'type', value: 'text/javascript' },
                    { name: 'class', value: SHADOW_UI_CLASSNAME.script },
                    { name: 'charset', value: 'UTF-8' },
                    { name: 'src', value: scriptUrl }
                ]));
            });
        }

        for (var i = result.length; i--; i > -1)
            parse5Utils.insertElement(result[i], head);
    }

    static _addCharsetInfo (head, charset) {
        parse5Utils.insertElement(parse5Utils.createElement('meta', [
            { name: 'class', value: SHADOW_UI_CLASSNAME.charset },
            { name: 'charset', value: charset }
        ]), head);
    }

    static _changeMetas (metas, domAdapter) {
        if (metas) {
            metas.forEach(meta => {
                // TODO: Figure out how to emulate the tag behavior.
                if (domAdapter.getAttr(meta, 'name') === 'referrer' && domAdapter.getAttr(meta, 'content') === 'origin')
                    parse5Utils.removeNode(meta);
                // NOTE: Remove the existing ‘compatible’ meta tag and add a new one at the beginning of the head.
                if (domAdapter.getAttr(meta, 'http-equiv') === 'X-UA-Compatible')
                    parse5Utils.removeNode(meta);
            });
        }
    }

    static _addCompatibilityMeta (head) {
        parse5Utils.insertElement(parse5Utils.createElement('meta', [
            { name: 'http-equiv', value: 'X-UA-Compatible' },
            { name: 'content', value: 'IE=edge' }
        ]), head);
    }

    static _prepareHtml (html, processingOpts) {
        if (processingOpts && processingOpts.iframeImageSrc)
            return `<html><body><img src="${processingOpts.iframeImageSrc}" /></body></html>`;

        return html;
    }

    _addBodyCreatedEventScript (body) {
        parse5Utils.insertElement(this.PARSED_BODY_CREATED_EVENT_SCRIPT, body);
    }

    shouldProcessResource (ctx) {
        // NOTE: In some cases, Firefox sends the default accept header for the script.
        // We should not try to process it as a page in this case.
        return (ctx.isPage || ctx.contentInfo.isIframeWithImageSrc) && !ctx.contentInfo.isScript;
    }

    processResource (html, ctx, charset, urlReplacer, processingOpts) {
        var pageProcessor = this;

        processingOpts = processingOpts || PageProcessor._getPageProcessingOptions(ctx, urlReplacer);

        var bom = getBOM(html);

        html = bom ? html.replace(bom, '') : html;

        PageProcessor._prepareHtml(html, processingOpts);

        var root       = this.parser.parse(html);
        var domAdapter = new DomAdapter(processingOpts.isIframe, processingOpts.crossDomainProxyPort);
        var elements   = parse5Utils.findElementsByTagNames(root, ['base', 'meta', 'head', 'body']);
        var base       = elements.base ? elements.base[0] : null;
        var baseUrl    = base ? domAdapter.getAttr(base, 'href') : '';
        var metas      = elements.meta;
        var head       = elements.head[0];
        var body       = elements.body[0];

        if (metas && charset.fromMeta(PageProcessor._getPageMetas(metas, domAdapter)))
            return this.RESTART_PROCESSING;

        var iframeHtmlProcessor = function (iframeHtml, callback) {
            var storedIsIframe = processingOpts.isIframe;

            processingOpts.isIframe = true;

            var result = pageProcessor.processResource(iframeHtml, ctx, charset, urlReplacer, processingOpts);

            processingOpts.isIframe = storedIsIframe;

            callback(result);
        };

        var domProcessor = new DomProcessor(domAdapter);
        var replacer     = (resourceUrl, resourceType, charsetAttrValue) => urlReplacer(resourceUrl, resourceType, charsetAttrValue, baseUrl);

        domProcessor.on(domProcessor.HTML_PROCESSING_REQUIRED_EVENT, iframeHtmlProcessor);
        parse5Utils.walkElements(root, el => domProcessor.processElement(el, replacer));
        domProcessor.off(domProcessor.HTML_PROCESSING_REQUIRED_EVENT, iframeHtmlProcessor);

        PageProcessor._addPageResources(head, processingOpts, domAdapter);
        this._addBodyCreatedEventScript(body, domAdapter);
        PageProcessor._changeMetas(metas, domAdapter);
        PageProcessor._addCharsetInfo(head, charset.get(), domAdapter);
        PageProcessor._addCompatibilityMeta(head, domAdapter);

        return (bom || '') + this.serializer.serialize(root);
    }
}

export default new PageProcessor();
