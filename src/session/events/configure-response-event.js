export default class ConfigureResponseEvent {
    constructor (requestContext, requestFilterRule, opts) {
        this._requestContext    = requestContext;
        this._requestFilterRule = requestFilterRule;
        this.opts               = opts;
    }

    setHeader (name, value) {
        this._requestContext.destRes.headers[name.toLowerCase()] = value;
    }

    removeHeader (name) {
        delete this._requestContext.destRes.headers[name.toLowerCase()];
    }
}
