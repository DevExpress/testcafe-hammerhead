export default class ConfigureResponseEventOptions {
    constructor (private _includeHeaders: boolean = false, private _includeBody: boolean = false) {
    }

    get includeHeaders () {
        return this._includeHeaders;
    }

    set includeHeaders (value: any) {
        this._includeHeaders = !!value;
    }

    get includeBody () {
        return this._includeBody;
    }

    set includeBody (value: any) {
        this._includeBody = !!value;
    }

    static get DEFAULT (): ConfigureResponseEventOptions {
        return new ConfigureResponseEventOptions();
    }
}
