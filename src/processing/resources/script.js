import ResourceProcessorBase from './resource-processor-base';
import Lru from 'lru-cache';
import scriptProcessor from '../script';

class ScriptResourceProcessor extends ResourceProcessorBase {
    constructor () {
        super();

        this.jsCache = new Lru({
            //NOTE: Max cache size is 50 MBytes
            max: 50 * 1024 * 1024,

            length: function (n) {
                // 1 char ~ 1 byte
                return n.length;
            }
        });
    }

    processResource (script) {
        var processedScript = this.jsCache.get(script);

        if (!processedScript) {
            processedScript = scriptProcessor.process(script);
            this.jsCache.set(script, processedScript);
        }

        return processedScript;
    }

    shouldProcessResource (ctx) {
        return ctx.contentInfo.isScript && !ctx.isXhr;
    }
}

export default new ScriptResourceProcessor();
