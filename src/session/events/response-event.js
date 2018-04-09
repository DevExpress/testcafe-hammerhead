export default class ResponseEvent {
    constructor (requestFilterRule, responseInfo) {
        this._requestFilterRule = requestFilterRule;

        Object.keys(responseInfo).forEach(key => {
            this[key] = responseInfo[key];
        });
    }
}
