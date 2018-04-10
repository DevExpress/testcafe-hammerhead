export default class RequestEvent {
    constructor (requestContext, requestFilterRule, requestInfo) {
        this._requestContext    = requestContext;
        this._requestFilterRule = requestFilterRule;
        this._requestInfo       = requestInfo;
    }

    setMock (mock) {
        this._requestContext.session.setMock(this._requestFilterRule, mock);
    }

    get requestOptions () {
        return this._requestContext.reqOpts;
    }

    get isAjax () {
        return this._requestInfo.isAjax;
    }
}
