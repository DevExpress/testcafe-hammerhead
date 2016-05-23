import ResourceProcessorBase from './resource-processor-base';
import Lru from 'lru-cache';
import { processScript } from '../script';

class ScriptResourceProcessor extends ResourceProcessorBase {
    constructor () {
        super();

        this.jsCache = new Lru({
            // NOTE: Max cache size is 50 MBytes.
            max: 50 * 1024 * 1024,

            length: function (n) {
                // NOTE: 1 char ~ 1 byte.
                return n.length;
            }
        });
    }

    processResource (script) {
        var processedScript = this.jsCache.get(script);

        if (!processedScript) {
            processedScript = processScript(script, true);
            this.jsCache.set(script, processedScript);
        }

        return processedScript;
    }

    shouldProcessResource (ctx) {
        return ctx.contentInfo.isScript;
    }
}

export default new ScriptResourceProcessor();
