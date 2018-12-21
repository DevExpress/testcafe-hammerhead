export default class RequestEvent {
    _requestContext: any;
    _requestFilterRule: any;
    _requestInfo: any;

    constructor (requestContext, requestFilterRule: any, requestInfo) {
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
