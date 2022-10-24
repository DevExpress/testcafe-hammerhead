import RequestFilterRule from '../request-filter-rule';
import {
    RequestEventListenerError,
    RequestEventListenersData,
    RequestEventListeners,
    RequestHookEventData, ConfigureResponseEventData,
} from '../typings';
import { RequestInfo } from './info';
import requestIsMatchRule from '../request-is-match-rule';
import ResponseMock from '../response-mock';
import RequestEventNames from './names';
import RequestEvent from './request-event';
import ResponseEvent from './response-event';
import ConfigureResponseEvent from './configure-response-event';


export default class RequestHookEventProvider {
    public readonly requestEventListeners: Map<string, RequestEventListenersData>;
    public readonly requestHookEventData: RequestHookEventData;

    public constructor () {
        this.requestEventListeners = new Map();
        this.requestHookEventData = this._initRequestHookEventData();
    }

    private _initRequestHookEventData (): RequestHookEventData {
        return {
            mocks:             new Map<string, ResponseMock>(),
            configureResponse: new Map<string, ConfigureResponseEventData>(),
        };
    }

    hasRequestEventListeners (): boolean {
        return !!this.requestEventListeners.size;
    }

    async addRequestEventListeners (rule: RequestFilterRule, listeners: RequestEventListeners, errorHandler: (event: RequestEventListenerError) => void): Promise<void> {
        const listenersData = {
            listeners,
            errorHandler,
            rule,
        };

        this.requestEventListeners.set(rule.id, listenersData);
    }

    async removeRequestEventListeners (rule: RequestFilterRule): Promise<void> {
        this.requestEventListeners.delete(rule.id);
    }

    clearRequestEventListeners (): void {
        this.requestEventListeners.clear();
    }

    async getRequestFilterRules (requestInfo: RequestInfo): Promise<RequestFilterRule[]> {
        const rulesArray = Array.from(this.requestEventListeners.values())
            .map(listenerData => listenerData.rule);

        const matchedRules = await Promise.all(rulesArray.map(async rule => {
            if (await requestIsMatchRule(rule, requestInfo))
                return rule;

            return void 0;
        }));

        return matchedRules.filter(rule => !!rule) as RequestFilterRule[];
    }

    async setMock (responseEventId: string, mock: ResponseMock): Promise<void> {
        this.requestHookEventData.mocks.set(responseEventId, mock);
    }

    getMock (responseEventId: string): ResponseMock | undefined {
        return this.requestHookEventData.mocks.get(responseEventId);
    }

    async _patchOnConfigureResponseEvent (eventName: RequestEventNames, event: RequestEvent | ResponseEvent | ConfigureResponseEvent): Promise<void> {
        // At present, this way is used only in the TestCafe's 'compiler service' run mode.
        // Later, we need to remove the old event-based mechanism and use this one.
        if (eventName !== RequestEventNames.onConfigureResponse)
            return;
        const targetEvent = event as ConfigureResponseEvent;
        const eventData   = this.requestHookEventData.configureResponse.get(targetEvent.id);

        if (!eventData)
            return;

        targetEvent.opts = eventData.opts;

        await Promise.all(eventData.setHeaders.map(({ name, value }) => {
            return targetEvent.setHeader(name, value);
        }));

        await Promise.all(eventData.removedHeaders.map(header => {
            return targetEvent.removeHeader(header);
        }));
    }

    async callRequestEventCallback (eventName: RequestEventNames, rule: RequestFilterRule, eventData: RequestEvent | ResponseEvent | ConfigureResponseEvent): Promise<void> {
        const requestEventListenersData = this.requestEventListeners.get(rule.id);

        if (!requestEventListenersData)
            return;

        const { listeners, errorHandler } = requestEventListenersData;
        const targetRequestEventCallback  = listeners[eventName];

        if (typeof targetRequestEventCallback !== 'function')
            return;

        try {
            await targetRequestEventCallback(eventData);

            await this._patchOnConfigureResponseEvent(eventName, eventData);
        }
        catch (e) {
            if (typeof errorHandler !== 'function')
                return;

            const event = {
                error:      e,
                methodName: eventName,
            };

            errorHandler(event);
        }
    }

    async callRequestHookErrorHandler (rule: RequestFilterRule, e: Error): Promise<void> {
        const requestEventListenersData = this.requestEventListeners.get(rule.id);

        if (!requestEventListenersData)
            return;

        const { errorHandler } = requestEventListenersData;

        const event = {
            error:      e,
            methodName: RequestEventNames.onResponse,
        };

        errorHandler(event);
    }
}
