export default abstract class ResourceProcessorBase {
    abstract processResource (ctx: any, content: string, charset: any, urlReplacer: any, processingOpts: any): void;
    abstract shouldProcessResource (ctx: any): boolean;
}
