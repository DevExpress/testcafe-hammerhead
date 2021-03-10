import util from 'util';
import parse5, { ASTNode } from 'parse5';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import DomProcessor from '../dom';
import DomAdapter from '../dom/parse5-dom-adapter';
import ResourceProcessorBase from './resource-processor-base';
import * as parse5Utils from '../../utils/parse5';
import getBOM from '../../utils/get-bom';
import getStorageKey from '../../utils/get-storage-key';
import SELF_REMOVING_SCRIPTS from '../../utils/self-removing-scripts';
import RequestPipelineContext from '../../request-pipeline/context';
import Charset from '../encoding/charset';
import BaseDomAdapter from '../dom/base-dom-adapter';
import SERVICE_ROUTES from '../../proxy/service-routes';
import { stringify as stringifyJSON } from '../../utils/json';

const PARSED_BODY_CREATED_EVENT_SCRIPT                = parse5.parseFragment(SELF_REMOVING_SCRIPTS.onBodyCreated).childNodes[0];
const PARSED_ORIGIN_FIRST_TITLE_ELEMENT_LOADED_SCRIPT = parse5.parseFragment(SELF_REMOVING_SCRIPTS.onOriginFirstTitleLoaded).childNodes[0];
const PARSED_INIT_SCRIPT_FOR_IFRAME_TEMPLATE          = parse5.parseFragment(SELF_REMOVING_SCRIPTS.iframeInit).childNodes[0];

interface PageProcessingOptions {
    crossDomainProxyPort: number;
    isIframe:             boolean;
    stylesheets:          string[];
    scripts:              string[];
    urlReplacer:          Function;
    isIframeWithImageSrc: boolean;
}

class PageProcessor extends ResourceProcessorBase {
    RESTART_PROCESSING: symbol;

    constructor () {
        super();

        this.RESTART_PROCESSING = Symbol();
    }

    private _createRestoreStoragesScript (storageKey: string, storages): ASTNode {
        const parsedDocumentFragment = parse5.parseFragment(util.format(SELF_REMOVING_SCRIPTS.restoreStorages,
            storageKey, stringifyJSON(storages.localStorage),
            storageKey, stringifyJSON(storages.sessionStorage)));

        return parsedDocumentFragment.childNodes[0];
    }

    private static _getPageProcessingOptions (ctx: RequestPipelineContext, urlReplacer: Function): PageProcessingOptions {
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

    private static _addPageResources (head: ASTNode, processingOptions: PageProcessingOptions): ASTNode[] {
        const injectedResources: ASTNode[] = [];

        if (processingOptions.stylesheets) {
            processingOptions.stylesheets.forEach(stylesheetUrl => {
                injectedResources.unshift(parse5Utils.createElement('link', [
                    { name: 'rel', value: 'stylesheet' },
                    { name: 'type', value: 'text/css' },
                    { name: 'class', value: SHADOW_UI_CLASSNAME.uiStylesheet },
                    { name: 'href', value: stylesheetUrl }
                ]));
            });

        }

        if (processingOptions.scripts) {
            processingOptions.scripts.forEach(scriptUrl => {
                injectedResources.push(parse5Utils.createElement('script', [
                    { name: 'type', value: 'text/javascript' },
                    { name: 'class', value: SHADOW_UI_CLASSNAME.script },
                    { name: 'charset', value: 'UTF-8' },
                    { name: 'src', value: scriptUrl }
                ]));
            });
        }

        for (let i = injectedResources.length - 1; i > -1; i--)
            parse5Utils.insertBeforeFirstScript(injectedResources[i], head);

        return injectedResources;
    }

    private static _getTaskScriptNodeIndex (head: ASTNode, ctx: RequestPipelineContext): number {
        const taskScriptUrls = [
            ctx.resolveInjectableUrl(SERVICE_ROUTES.task),
            ctx.resolveInjectableUrl(SERVICE_ROUTES.iframeTask)
        ];

        return parse5Utils.findNodeIndex(head, node => {
            return node.tagName === 'script' &&
                !!node.attrs.find(attr => attr.name === 'class' && attr.value === SHADOW_UI_CLASSNAME.script) &&
                !!node.attrs.find(attr => attr.name === 'src' && taskScriptUrls.includes(attr.value));
        });
    }

    /**
     * Inject the service script after the first title element
     * or after injected resources,
     * if they are placed right after the <title> tag
     **/
    private static _addPageOriginFirstTitleParsedScript (head: ASTNode, ctx: RequestPipelineContext): void {
        const firstTitleNodeIndex = parse5Utils.findNodeIndex(head, node => node.tagName === 'title');

        if (firstTitleNodeIndex === -1)
            return;

        const taskScriptNodeIndex = PageProcessor._getTaskScriptNodeIndex(head, ctx);
        const insertIndex         = taskScriptNodeIndex > firstTitleNodeIndex
            ? taskScriptNodeIndex + 1
            : firstTitleNodeIndex + 1;

        parse5Utils.appendNode(PARSED_ORIGIN_FIRST_TITLE_ELEMENT_LOADED_SCRIPT, head, insertIndex);
    }

    private static _addCharsetInfo (head: ASTNode, charset: string): void {
        parse5Utils.unshiftElement(parse5Utils.createElement('meta', [
            { name: 'class', value: SHADOW_UI_CLASSNAME.charset },
            { name: 'charset', value: charset }
        ]), head);
    }

    private static _changeMetas (metas, domAdapter: BaseDomAdapter): void {
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

    private _addRestoreStoragesScript (ctx: RequestPipelineContext, head: ASTNode): void {
        const storageKey            = getStorageKey(ctx.session.id, ctx.dest.host);
        const restoreStoragesScript = this._createRestoreStoragesScript(storageKey, ctx.restoringStorages);

        parse5Utils.insertBeforeFirstScript(restoreStoragesScript, head);
    }

    private static _addBodyCreatedEventScript (body: ASTNode): void {
        parse5Utils.unshiftElement(PARSED_BODY_CREATED_EVENT_SCRIPT, body);
    }

    shouldProcessResource (ctx: RequestPipelineContext): boolean {
        // NOTE: In some cases, Firefox sends the default accept header for the script.
        // We should not try to process it as a page in this case.
        return (ctx.isPage || ctx.contentInfo.isIframeWithImageSrc) && !ctx.contentInfo.isScript &&
               !ctx.contentInfo.isFileDownload;
    }

    processResource (html: string, ctx: RequestPipelineContext, charset: Charset, urlReplacer: Function, isSrcdoc = false): string | symbol {
        const processingOpts = PageProcessor._getPageProcessingOptions(ctx, urlReplacer);
        const bom            = getBOM(html);

        if (isSrcdoc)
            processingOpts.isIframe = true;

        html = bom ? html.replace(bom, '') : html;

        PageProcessor._prepareHtml(html, processingOpts);

        const root       = parse5.parse(html);
        const domAdapter = new DomAdapter(processingOpts.isIframe, ctx, charset, urlReplacer);
        const elements   = parse5Utils.findElementsByTagNames(root, ['base', 'meta', 'head', 'body', 'frameset']);
        const base       = elements.base ? elements.base[0] : null;
        const baseUrl    = base ? domAdapter.getAttr(base, 'href') : '';
        const metas      = elements.meta;
        const head       = elements.head[0];
        const body       = elements.body ? elements.body[0] : elements.frameset[0];

        if (!isSrcdoc && metas && charset.fromMeta(PageProcessor._getPageMetas(metas, domAdapter)))
            return this.RESTART_PROCESSING;

        const domProcessor = new DomProcessor(domAdapter);
        const replacer     = (resourceUrl, resourceType, charsetAttrValue, isCrossDomain = false) =>
            urlReplacer(resourceUrl, resourceType, charsetAttrValue, baseUrl, isCrossDomain);

        domProcessor.forceProxySrcForImage = ctx.session.hasRequestEventListeners();
        domProcessor.allowMultipleWindows  = ctx.session.options.allowMultipleWindows;

        parse5Utils.walkElements(root, el => domProcessor.processElement(el, replacer));

        if (isSrcdoc)
            parse5Utils.unshiftElement(PARSED_INIT_SCRIPT_FOR_IFRAME_TEMPLATE, head);
        else if (!ctx.isHtmlImport) {
            PageProcessor._addPageResources(head, processingOpts);
            PageProcessor._addPageOriginFirstTitleParsedScript(head, ctx);
            PageProcessor._addBodyCreatedEventScript(body);

            if (ctx.restoringStorages && !processingOpts.isIframe)
                this._addRestoreStoragesScript(ctx, head);
        }

        PageProcessor._changeMetas(metas, domAdapter);
        PageProcessor._addCharsetInfo(head, charset.get());

        return (bom || '') + parse5.serialize(root);
    }
}

export default new PageProcessor();
