export default class ResourceProcessorBase {
    processResource (/* ctx, content, charset, urlReplacer */) {
        throw new Error('Not implemented');
    }

    shouldProcessResource (/* ctx */) {
        throw new Error('Not implemented');
    }
}
