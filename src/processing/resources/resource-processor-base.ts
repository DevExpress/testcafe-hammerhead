/*eslint-disable no-unused-vars*/
import RequestPipelineContext from '../../request-pipeline/context';
import Charset from '../encoding/charset';
/*eslint-enable no-unused-vars*/

export default abstract class ResourceProcessorBase {
    abstract processResource (content: string, ctx: RequestPipelineContext, _charset: Charset, urlReplacer: Function): string | Symbol;
    abstract shouldProcessResource (ctx: RequestPipelineContext): boolean;
}
