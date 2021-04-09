import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import RequestPipelineContext from '../../request-pipeline/context';
import ResponseMock from '../../request-pipeline/request-hooks/response-mock';
import { RequestInfo } from './info';
import generateUniqueId from '../../utils/generate-unique-id';

export default class RequestEvent {
    public readonly requestFilterRule: RequestFilterRule;
    private readonly _requestContext: RequestPipelineContext;
    private readonly _requestInfo: RequestInfo;
    public readonly id: string;

    constructor (requestFilterRule: RequestFilterRule, requestContext: RequestPipelineContext, requestInfo: RequestInfo) {
        this.requestFilterRule  = requestFilterRule;
        this._requestContext    = requestContext;
        this._requestInfo       = requestInfo;
        this.id                 = generateUniqueId();
    }

    async setMock (mock: ResponseMock): Promise<void> {
        await this._requestContext.session.setMock(this.id, mock);
    }

    get requestOptions () {
        return this._requestContext.reqOpts;
    }

    get isAjax (): boolean {
        return this._requestInfo.isAjax;
    }
}
