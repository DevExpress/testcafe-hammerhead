export default class ConfigureResponseEventOptions {
    includeHeaders: boolean;
    includeBody: boolean;

    constructor (includeHeaders: boolean, includeBody: boolean) {
        this.includeHeaders = includeHeaders;
        this.includeBody    = includeBody;
    }

    static get DEFAULT () {
        return new ConfigureResponseEventOptions(false, false);
    }
}
