import RequestFilterRule from '../request-hooks/request-filter-rule';
import RequestHookEventProvider from '../request-hooks/events/event-provider';
import BaseRequestHookEventFactory from '../request-hooks/events/factory/base';
import RequestEvent from '../../session/events/request-event';
import RequestOptions from '../request-options';
import RequestEventNames from '../request-hooks/events/names';
import ResponseMock from '../request-hooks/response-mock';
import IncomingMessageLike from '../incoming-message-like';
import getMockResponse from '../request-hooks/response-mock/get-response';
import { PreparedResponseInfo } from '../request-hooks/events/info';
import ResponseEvent from '../../session/events/response-event';
import { OnResponseEventData } from '../../typings/context';
import ConfigureResponseEventOptions from '../../session/events/configure-response-event-options';


export default abstract class BaseRequestPipelineContext {
    public requestFilterRules: RequestFilterRule[];
    public requestId: string;
    public reqOpts: RequestOptions;
    public mock: ResponseMock;
    public onResponseEventData: OnResponseEventData[] = [];

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

    public getOnResponseEventData ({ includeBody }: { includeBody: boolean }): OnResponseEventData[] {
        return this.onResponseEventData.filter(eventData => eventData.opts.includeBody === includeBody);
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

    public async onRequestHookConfigureResponse (eventProvider: RequestHookEventProvider, eventFactory: BaseRequestHookEventFactory): Promise<void> {
        await Promise.all(this.requestFilterRules.map(async rule => {
            const configureResponseEvent = eventFactory.createConfigureResponseEvent(rule);

            await eventProvider.callRequestEventCallback(RequestEventNames.onConfigureResponse, rule, configureResponseEvent);

            this.onResponseEventData.push({
                rule: configureResponseEvent.requestFilterRule,
                opts: configureResponseEvent.opts,
            });
        }));
    }

    public async onRequestHookResponse (eventProvider: RequestHookEventProvider, eventFactory: BaseRequestHookEventFactory, rule: RequestFilterRule, opts: ConfigureResponseEventOptions): Promise<ResponseEvent> {
        const responseInfo         = eventFactory.createResponseInfo();
        const preparedResponseInfo = new PreparedResponseInfo(responseInfo, opts);
        const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

        await eventProvider.callRequestEventCallback(RequestEventNames.onResponse, rule, responseEvent);

        return responseEvent;
    }

    public async getMockResponse (): Promise<IncomingMessageLike> {
        this.mock.setRequestOptions(this.reqOpts);

        return getMockResponse(this.mock);
    }

    public async handleMockError (eventProvider: RequestHookEventProvider): Promise<void> {
        const targetRule = this.requestFilterRules[0];

        await eventProvider.callRequestHookErrorHandler(targetRule, this.mock.error as Error);

    }
}
