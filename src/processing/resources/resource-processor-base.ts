export default abstract class ResourceProcessorBase {
    abstract processResource (ctx: any, _content: string, _charset: any, urlReplacer: any, processingOpts: any): void;
    abstract shouldProcessResource (ctx: any): boolean;
}
