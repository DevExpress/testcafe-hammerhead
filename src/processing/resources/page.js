import parse5 from 'parse5';
import dedent from 'dedent';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import DomProcessor from '../dom';
import DomAdapter from '../dom/parse5-dom-adapter';
import ResourceProcessorBase from './resource-processor-base';
import * as parse5Utils from '../../utils/parse5';
import getBOM from '../../utils/get-bom';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import getStorageKey from '../../utils/get-storage-key';

const BODY_CREATED_EVENT_SCRIPT = dedent(`
    <script type="text/javascript" class="${ SHADOW_UI_CLASSNAME.selfRemovingScript }">
        (function () {
            if (window["${ INTERNAL_PROPS.hammerhead }"])
                window["${ INTERNAL_PROPS.hammerhead }"].sandbox.node.raiseBodyCreatedEvent();

            var script = document.currentScript || document.scripts[document.scripts.length - 1];
            script.parentNode.removeChild(script);
        })();
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

    _createRestoreStoragesScript (storageKey, storages) {
        const scriptStr = dedent(`
            <script type="text/javascript" class="${ SHADOW_UI_CLASSNAME.selfRemovingScript }">
                (function () {
                    window.localStorage.setItem("${ storageKey }", ${ JSON.stringify(storages.localStorage) });
                    window.sessionStorage.setItem("${ storageKey }", ${ JSON.stringify(storages.sessionStorage) });

                    var script = document.currentScript || document.scripts[document.scripts.length - 1];
                    script.parentNode.removeChild(script);
                })();
            </script>
        `);

        return this.parser.parseFragment(scriptStr).childNodes[0];
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
        const metas = [];

        for (let i = 0; i < metaEls.length; i++) {
            metas.push({
                httpEquiv: domAdapter.getAttr(metaEls[i], 'http-equiv'),
                content:   domAdapter.getAttr(metaEls[i], 'content'),
                charset:   domAdapter.getAttr(metaEls[i], 'charset')
            });
        }

        return metas;
    }

    static _addPageResources (head, processingOptions) {
        const result = [];

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

        for (let i = result.length - 1; i > -1; i--)
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
                if (domAdapter.getAttr(meta, 'name') === 'referrer')
                    parse5Utils.setAttr(meta, 'content', 'unsafe-url');
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

    _addRestoreStoragesScript (ctx, head) {
        const storageKey            = getStorageKey(ctx.session.id, ctx.dest.host);
        const restoreStoragesScript = this._createRestoreStoragesScript(storageKey, ctx.restoringStorages);

        parse5Utils.insertElement(restoreStoragesScript, head);
    }

    _addBodyCreatedEventScript (body) {
        parse5Utils.insertElement(this.PARSED_BODY_CREATED_EVENT_SCRIPT, body);
    }

    shouldProcessResource (ctx) {
        // NOTE: In some cases, Firefox sends the default accept header for the script.
        // We should not try to process it as a page in this case.
        return (ctx.isPage || ctx.contentInfo.isIframeWithImageSrc) && !ctx.contentInfo.isScript &&
               !ctx.contentInfo.isFileDownload;
    }

    processResource (html, ctx, charset, urlReplacer, processingOpts) {
        processingOpts = processingOpts || PageProcessor._getPageProcessingOptions(ctx, urlReplacer);

        const bom = getBOM(html);

        html = bom ? html.replace(bom, '') : html;

        PageProcessor._prepareHtml(html, processingOpts);

        const root       = this.parser.parse(html);
        const domAdapter = new DomAdapter(processingOpts.isIframe, processingOpts.crossDomainProxyPort);
        const elements   = parse5Utils.findElementsByTagNames(root, ['base', 'meta', 'head', 'body', 'frameset']);
        const base       = elements.base ? elements.base[0] : null;
        const baseUrl    = base ? domAdapter.getAttr(base, 'href') : '';
        const metas      = elements.meta;
        const head       = elements.head[0];
        const body       = elements.body ? elements.body[0] : elements.frameset[0];

        if (metas && charset.fromMeta(PageProcessor._getPageMetas(metas, domAdapter)))
            return this.RESTART_PROCESSING;

        const domProcessor = new DomProcessor(domAdapter);
        const replacer     = (resourceUrl, resourceType, charsetAttrValue) => urlReplacer(resourceUrl, resourceType, charsetAttrValue, baseUrl);

        parse5Utils.walkElements(root, el => domProcessor.processElement(el, replacer));

        if (!ctx.isHtmlImport) {
            PageProcessor._addPageResources(head, processingOpts, domAdapter);
            this._addBodyCreatedEventScript(body, domAdapter);

            if (ctx.restoringStorages && !processingOpts.isIframe)
                this._addRestoreStoragesScript(ctx, head);
        }

        PageProcessor._changeMetas(metas, domAdapter);
        PageProcessor._addCharsetInfo(head, charset.get(), domAdapter);
        PageProcessor._addCompatibilityMeta(head, domAdapter);

        return (bom || '') + this.serializer.serialize(root);
    }
}

export default new PageProcessor();
