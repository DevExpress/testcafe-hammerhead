import RequestFilterRule from "../../request-pipeline/request-hooks/request-filter-rule";

export default class RequestEvent {
    _requestContext: any;
    _requestFilterRule: RequestFilterRule;
    _requestInfo: any;

    constructor (requestContext, requestFilterRule: RequestFilterRule, requestInfo) {
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
