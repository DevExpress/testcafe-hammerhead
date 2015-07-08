import ResourceProcessorBase from './resource-processor-base';
import jsProcessor from '../js';

class JsonProcessor extends ResourceProcessorBase {
    processResource (json) {
        return jsProcessor.process(json, true);
    }

    shouldProcessResource (ctx) {
        return ctx.contentInfo.isJSON;
    }
}

export default new JsonProcessor();

