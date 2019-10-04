import ResourceProcessorBase from './resource-processor-base';
import styleProcessor from '../style';
import RequestPipelineContext from '../../request-pipeline/context';
import Charset from '../encoding/charset';

class StylesheetProcessor extends ResourceProcessorBase {
    processResource (stylesheet: string, _ctx: RequestPipelineContext, _charset: Charset, urlReplacer: Function) {
        return styleProcessor.process(stylesheet, urlReplacer);
    }

    shouldProcessResource (ctx: RequestPipelineContext): boolean {
        return ctx.contentInfo.isCSS;
    }
}

export default new StylesheetProcessor();
