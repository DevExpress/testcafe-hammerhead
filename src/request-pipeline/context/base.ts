import RequestFilterRule from '../request-hooks/request-filter-rule';
import RequestHookEventProvider from '../request-hooks/events/event-provider';
import BaseRequestHookEventFactory from '../request-hooks/events/factory/base';
import RequestEvent from '../../session/events/request-event';
import RequestOptions from '../request-options';
import RequestEventNames from '../request-hooks/events/names';
import ResponseMock from '../request-hooks/response-mock';
import IncomingMessageLike from '../incoming-message-like';
import getMockResponse from '../request-hooks/response-mock/get-response';


export default abstract class BaseRequestPipelineContext {
    public requestFilterRules: RequestFilterRule[];
    public requestId: string;
    public reqOpts: RequestOptions;
    public mock: ResponseMock;

    protected constructor (requestId: string) {
        this.requestFilterRules = [];
        this.requestId          = requestId;
    }

    public async forEachRequestFilterRule (fn: (rule: RequestFilterRule) => Promise<void>): Promise<void> {
        await Promise.all(this.requestFilterRules.map(fn));
    }

    private setupMockIfNecessary (event: RequestEvent, eventProvider: RequestHookEventProvider): void {
        const mock = eventProvider.getMock(event.id);

        if (mock && !this.mock)
            this.mock = mock;
    }

    public setRequestOptions (eventFactory: BaseRequestHookEventFactory): void {
        this.reqOpts = eventFactory.createRequestOptions();
    }

    public async onRequestHookRequest (eventProvider: RequestHookEventProvider, eventFactory: BaseRequestHookEventFactory): Promise<void> {
        const requestInfo = eventFactory.createRequestInfo();

        this.requestFilterRules = await eventProvider.getRequestFilterRules(requestInfo);

        await this.forEachRequestFilterRule(async rule => {
            const requestEvent = new RequestEvent({
                requestFilterRule: rule,
                _requestInfo:      requestInfo,
                reqOpts:           this.reqOpts,
                setMockFn:         eventProvider.setMock.bind(eventProvider),
            });

            await eventProvider.callRequestEventCallback(RequestEventNames.onRequest, rule, requestEvent);

            this.setupMockIfNecessary(requestEvent, eventProvider);
        });
    }

    public async getMockResponse (): Promise<IncomingMessageLike> {
        this.mock.setRequestOptions(this.reqOpts);

        return getMockResponse(this.mock);
    }
}
