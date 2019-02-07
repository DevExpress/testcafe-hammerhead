export default class ConfigureResponseEvent {
    _requestContext: any;
    _requestFilterRule: any;
    opts: any;

    constructor (requestContext: any, requestFilterRule: any, opts: any) {
        this._requestContext    = requestContext;
        this._requestFilterRule = requestFilterRule;
        this.opts               = opts;
    }

    setHeader (name: string, value: string) {
        this._requestContext.destRes.headers[name.toLowerCase()] = value;
    }

    removeHeader (name: string) {
        delete this._requestContext.destRes.headers[name.toLowerCase()];
    }
}
