export default class ConfigureResponseEventOptions {
    constructor (includeHeaders, includeBody) {
        this.includeHeaders = includeHeaders;
        this.includeBody    = includeBody;
    }

    static get DEFAULT () {
        return new ConfigureResponseEventOptions(false, false);
    }
}
