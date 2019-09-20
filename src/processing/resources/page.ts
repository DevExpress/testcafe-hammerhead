import parse5 from 'parse5';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import DomProcessor from '../dom';
import DomAdapter from '../dom/parse5-dom-adapter';
import ResourceProcessorBase from './resource-processor-base';
import * as parse5Utils from '../../utils/parse5';
import getBOM from '../../utils/get-bom';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import getStorageKey from '../../utils/get-storage-key';
import createSelfRemovingScript from '../../utils/create-self-removing-script';
import RequestPipelineContext from '../../request-pipeline/context';
import Charset from '../encoding/charset';
import BaseDomAdapter from '../dom/base-dom-adapter';

const BODY_CREATED_EVENT_SCRIPT: string = createSelfRemovingScript(`
    if (window["${ INTERNAL_PROPS.hammerhead }"])
        window["${ INTERNAL_PROPS.hammerhead }"].sandbox.node.raiseBodyCreatedEvent();
`);

class PageProcessor extends ResourceProcessorBase {
    RESTART_PROCESSING: symbol;
    PARSED_BODY_CREATED_EVENT_SCRIPT: parse5.ASTNode;

    constructor () {
        super();

        const parsedDocumentFragment = parse5.parseFragment(BODY_CREATED_EVENT_SCRIPT);

        this.RESTART_PROCESSING               = Symbol();
        this.PARSED_BODY_CREATED_EVENT_SCRIPT = parsedDocumentFragment.childNodes[0];
    }

    private _createRestoreStoragesScript (storageKey, storages) {
        const scriptStr              = createSelfRemovingScript(`
            window.localStorage.setItem("${ storageKey }", ${ JSON.stringify(storages.localStorage) });
            window.sessionStorage.setItem("${ storageKey }", ${ JSON.stringify(storages.sessionStorage) });
        `);
        const parsedDocumentFragment = parse5.parseFragment(scriptStr);

        return parsedDocumentFragment.childNodes[0];
    }

    private static _getPageProcessingOptions (ctx: RequestPipelineContext, urlReplacer: Function) {
        return {
            crossDomainProxyPort: ctx.serverInfo.crossDomainPort,
            isIframe:             ctx.isIframe,
            stylesheets:          ctx.getInjectableStyles(),
            scripts:              ctx.getInjectableScripts(),
            urlReplacer:          urlReplacer,
            isIframeWithImageSrc: ctx.contentInfo && ctx.contentInfo.isIframeWithImageSrc
        };
    }

    private static _getPageMetas (metaEls, domAdapter: BaseDomAdapter) {
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

    private static _addPageResources (head: any, processingOptions: any) {
        const result = [];

        if (processingOptions.stylesheets) {
            processingOptions.stylesheets.forEach(stylesheetUrl => {
                result.unshift(parse5Utils.createElement('link', [
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
            parse5Utils.insertBeforeFirstScript(result[i], head);
    }

    private static _addCharsetInfo (head: any, charset: string) {
        parse5Utils.unshiftElement(parse5Utils.createElement('meta', [
            { name: 'class', value: SHADOW_UI_CLASSNAME.charset },
            { name: 'charset', value: charset }
        ]), head);
    }

    private static _changeMetas (metas, domAdapter: BaseDomAdapter) {
        if (metas) {
            metas.forEach(meta => {
                // TODO: Figure out how to emulate the tag behavior.
                if (domAdapter.getAttr(meta, 'name') === 'referrer')
                    parse5Utils.setAttr(meta, 'content', 'unsafe-url');
            });
        }
    }

    private static _prepareHtml (html: string, processingOpts): string {
        if (processingOpts && processingOpts.iframeImageSrc)
            return `<html><body><img src="${processingOpts.iframeImageSrc}" /></body></html>`;

        return html;
    }

    private _addRestoreStoragesScript (ctx: RequestPipelineContext, head: parse5.ASTNode) {
        const storageKey            = getStorageKey(ctx.session.id, ctx.dest.host);
        const restoreStoragesScript = this._createRestoreStoragesScript(storageKey, ctx.restoringStorages);

        parse5Utils.insertBeforeFirstScript(restoreStoragesScript, head);
    }

    private _addBodyCreatedEventScript (body: parse5.ASTNode) {
        parse5Utils.unshiftElement(this.PARSED_BODY_CREATED_EVENT_SCRIPT, body);
    }

    shouldProcessResource (ctx: RequestPipelineContext): boolean {
        // NOTE: In some cases, Firefox sends the default accept header for the script.
        // We should not try to process it as a page in this case.
        return (ctx.isPage || ctx.contentInfo.isIframeWithImageSrc) && !ctx.contentInfo.isScript &&
               !ctx.contentInfo.isFileDownload;
    }

    processResource (html: string, _ctx: RequestPipelineContext, _charset: Charset, urlReplacer: Function): string | symbol {
        const processingOpts = PageProcessor._getPageProcessingOptions(_ctx, urlReplacer);
        const bom            = getBOM(html);

        html = bom ? html.replace(bom, '') : html;

        PageProcessor._prepareHtml(html, processingOpts);

        const root       = parse5.parse(html);
        const domAdapter = new DomAdapter(processingOpts.isIframe, processingOpts.crossDomainProxyPort);
        const elements   = parse5Utils.findElementsByTagNames(root, ['base', 'meta', 'head', 'body', 'frameset']);
        const base       = elements.base ? elements.base[0] : null;
        const baseUrl    = base ? domAdapter.getAttr(base, 'href') : '';
        const metas      = elements.meta;
        const head       = elements.head[0];
        const body       = elements.body ? elements.body[0] : elements.frameset[0];

        if (metas && _charset.fromMeta(PageProcessor._getPageMetas(metas, domAdapter)))
            return this.RESTART_PROCESSING;

        const domProcessor = new DomProcessor(domAdapter);
        const replacer     = (resourceUrl, resourceType, charsetAttrValue) => urlReplacer(resourceUrl, resourceType, charsetAttrValue, baseUrl);

        domProcessor.forceProxySrcForImage = _ctx.session.hasRequestEventListeners();
        domProcessor.allowMultipleWindows  = _ctx.session.allowMultipleWindows;
        parse5Utils.walkElements(root, el => domProcessor.processElement(el, replacer));

        if (!_ctx.isHtmlImport) {
            PageProcessor._addPageResources(head, processingOpts);
            this._addBodyCreatedEventScript(body);

            if (_ctx.restoringStorages && !processingOpts.isIframe)
                this._addRestoreStoragesScript(_ctx, head);
        }

        PageProcessor._changeMetas(metas, domAdapter);
        PageProcessor._addCharsetInfo(head, _charset.get());

        return (bom || '') + parse5.serialize(root);
    }
}

export default new PageProcessor();
