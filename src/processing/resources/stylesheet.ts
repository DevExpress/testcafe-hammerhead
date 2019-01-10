import ResourceProcessorBase from './resource-processor-base';
import styleProcessor from '../style';

class StylesheetProcessor extends ResourceProcessorBase {
    processResource (stylesheet, _ctx, _charset, urlReplacer) {
        return styleProcessor.process(stylesheet, urlReplacer);
    }

    shouldProcessResource (ctx) {
        return ctx.contentInfo.isCSS;
    }
}

export default new StylesheetProcessor();
