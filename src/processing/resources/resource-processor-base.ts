import RequestPipelineContext from '../../request-pipeline/context';
import Charset from '../encoding/charset';

export default abstract class ResourceProcessorBase {
    abstract processResource (content: string, ctx: RequestPipelineContext, _charset: Charset, urlReplacer: Function): string | symbol;
    abstract shouldProcessResource (ctx: RequestPipelineContext): boolean;
}
