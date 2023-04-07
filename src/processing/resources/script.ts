import ResourceProcessorBase from './resource-processor-base';
import LRUCache from 'lru-cache';
import { processScript } from '../script';
import RequestPipelineContext from '../../request-pipeline/context';
import Charset from '../encoding/charset';
import { updateScriptImportUrls } from '../../utils/url';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';

class ScriptResourceProcessor extends ResourceProcessorBase {
    jsCache: LRUCache<string, string>;

    constructor () {
        super();

        this.jsCache = new LRUCache({
            max:    50 * 1024 * 1024, // NOTE: Max cache size is 50 MBytes.
            length: n => n.length, // NOTE: 1 char ~ 1 byte.
        });
    }

    processResource (script: string, ctx: RequestPipelineContext, _charset: Charset, urlReplacer: Function): string {
        if (!script)
            return script;

        let processedScript = this.jsCache.get(script);

        if (!processedScript) {
            processedScript = processScript(script, true, false, urlReplacer,
                ctx.destRes.headers[BUILTIN_HEADERS.serviceWorkerAllowed] as string,
                ctx.nativeAutomation);
            this.jsCache.set(script, processedScript);
        }
        else
            processedScript = updateScriptImportUrls(processedScript, ctx.serverInfo, ctx.session.id, ctx.windowId);

        return processedScript;
    }

    shouldProcessResource (ctx: RequestPipelineContext): boolean {
        return ctx.contentInfo.isScript;
    }
}

export default new ScriptResourceProcessor();
