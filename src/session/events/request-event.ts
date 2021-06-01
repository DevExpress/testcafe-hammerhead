import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import RequestPipelineContext from '../../request-pipeline/context';
import ResponseMock from '../../request-pipeline/request-hooks/response-mock';
import { RequestInfo } from './info';
import generateUniqueId from '../../utils/generate-unique-id';
import RequestOptions from '../../request-pipeline/request-options';

interface SerializedRequestEvent {
    requestFilterRule: RequestFilterRule;
    _requestInfo: RequestInfo;
    id: string;
}

export default class RequestEvent {
    public readonly requestFilterRule: RequestFilterRule;
    private readonly _requestContext: RequestPipelineContext | null;
    private readonly _requestInfo: RequestInfo;
    public id: string;

    public constructor (requestFilterRule: RequestFilterRule, requestContext: RequestPipelineContext | null, requestInfo: RequestInfo) {
        this.requestFilterRule  = requestFilterRule;
        this._requestContext    = requestContext;
        this._requestInfo       = requestInfo;
        this.id                 = generateUniqueId();
    }

    public async setMock (mock: ResponseMock): Promise<void> {
        await this._requestContext?.session.setMock(this.id, mock);
    }

    public get requestOptions (): RequestOptions | undefined {
        return this._requestContext?.reqOpts;
    }

    public get isAjax (): boolean {
        return this._requestInfo.isAjax;
    }

    public static from (data: unknown): RequestEvent {
        const { id, requestFilterRule, _requestInfo } = data as SerializedRequestEvent;

        const requestEvent = new RequestEvent(requestFilterRule, null, _requestInfo);

        requestEvent.id = id;

        return requestEvent;
    }
}
