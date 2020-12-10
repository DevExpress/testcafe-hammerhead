import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import RequestPipelineContext from '../../request-pipeline/context';
import ResponseMock from '../../request-pipeline/request-hooks/response-mock';
import { RequestInfo } from './info';

export default class RequestEvent {
    private readonly _requestContext: RequestPipelineContext;
    private readonly _requestFilterRule: RequestFilterRule;
    private readonly _requestInfo: RequestInfo;

    constructor (requestContext: RequestPipelineContext, requestFilterRule: RequestFilterRule, requestInfo: RequestInfo) {
        this._requestContext    = requestContext;
        this._requestFilterRule = requestFilterRule;
        this._requestInfo       = requestInfo;
    }

    setMock (mock: ResponseMock) {
        if (this._requestContext.session)
            this._requestContext.session.setMock(this._requestFilterRule, mock);
    }

    get requestOptions () {
        return this._requestContext.reqOpts;
    }

    get isAjax (): boolean {
        return this._requestInfo.isAjax;
    }
}
