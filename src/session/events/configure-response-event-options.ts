export default class ConfigureResponseEventOptions {
    readonly includeHeaders: boolean;
    readonly includeBody: boolean;

    constructor (includeHeaders: boolean = false, includeBody: boolean = false) {
        this.includeHeaders = includeHeaders;
        this.includeBody    = includeBody;
    }

    static get DEFAULT (): ConfigureResponseEventOptions {
        return new ConfigureResponseEventOptions();
    }
}
