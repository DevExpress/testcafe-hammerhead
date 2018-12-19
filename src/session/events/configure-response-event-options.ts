export default class ConfigureResponseEventOptions {
    includeHeaders: boolean;
    includeBody: boolean;

    constructor (includeHeaders, includeBody) {
        this.includeHeaders = includeHeaders;
        this.includeBody    = includeBody;
    }

    static get DEFAULT () {
        return new ConfigureResponseEventOptions(false, false);
    }
}
