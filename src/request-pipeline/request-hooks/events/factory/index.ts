import BaseRequestHookEventFactory from './base';
import { RequestInfo, ResponseInfo } from '../info';
import RequestPipelineContext from '../../../context';
import RequestOptions from '../../../request-options';
import ConfigureResponseEvent from '../configure-response-event';
import RequestFilterRule from '../../request-filter-rule';


export default class RequestPipelineRequestHookEventFactory extends BaseRequestHookEventFactory {
    private readonly _ctx: RequestPipelineContext;

    public constructor (ctx: RequestPipelineContext) {
        super();

        this._ctx = ctx;
    }

    public createRequestInfo (): RequestInfo {
        return RequestInfo.from(this._ctx);
    }

    public createRequestOptions (): RequestOptions {
        return RequestOptions.createFrom(this._ctx);
    }

    public createConfigureResponseEvent (rule: RequestFilterRule): ConfigureResponseEvent {
        return new ConfigureResponseEvent(rule, {
            setHeader: (name, value) => {
                this._ctx.destRes.headers[name.toLowerCase()] = value;
            },
            removeHeader: name => {
                delete this._ctx.destRes.headers[name.toLowerCase()];
            },
        });
    }

    public createResponseInfo (): ResponseInfo {
        return ResponseInfo.from(this._ctx);
    }
}
