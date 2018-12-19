export default class ResponseEvent {
    _requestFilterRule: any;

    constructor (requestFilterRule, responseInfo) {
        this._requestFilterRule = requestFilterRule;

        Object.keys(responseInfo).forEach(key => {
            this[key] = responseInfo[key];
        });
    }
}
