export default class ConfigureResponseEvent {
    constructor (requestFilterRule, opts) {
        this._requestFilterRule = requestFilterRule;
        this.opts               = opts;
    }
}
