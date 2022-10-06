import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import ResponseMock from '../../request-pipeline/request-hooks/response-mock';
import { RequestInfo } from '../../request-pipeline/request-hooks/events/info';
import generateUniqueId from '../../utils/generate-unique-id';
import RequestOptions from '../../request-pipeline/request-options';
import { RequestInfoInit } from '../../request-pipeline/request-hooks/typings';

interface SerializedRequestEvent {
    requestFilterRule: RequestFilterRule;
    _requestInfo: RequestInfo;
    id: string;
}

export default class RequestEvent {
    public readonly requestFilterRule: RequestFilterRule;
    private readonly _requestInfo: RequestInfo;
    private readonly reqOpts: RequestOptions;
    private readonly setMockFn: (responseEventId: string, mock: ResponseMock) => Promise<void>;
    public id: string;

    public constructor (init: RequestInfoInit) {
        Object.assign(this, init);

        this.id = generateUniqueId();
    }

    public async setMock (mock: ResponseMock): Promise<void> {
        await this.setMockFn(this.id, mock);
    }

    public get requestOptions (): RequestOptions | undefined {
        return this.reqOpts;
    }

    public get isAjax (): boolean {
        return this._requestInfo.isAjax;
    }

    public static from (data: unknown): RequestEvent {
        const { id, requestFilterRule, _requestInfo } = data as SerializedRequestEvent;

        const requestEvent = new RequestEvent({
            requestFilterRule: requestFilterRule,
            reqOpts:           {} as RequestOptions,
            setMockFn:         () => Promise.resolve(),
            _requestInfo,
        });

        requestEvent.id = id;

        return requestEvent;
    }
}
