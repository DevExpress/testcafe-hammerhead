import RequestPipelineContext from '../../request-pipeline/context';
import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import ConfigureResponseEventOptions from './configure-response-event-options';

export default class ConfigureResponseEvent {
    private readonly _requestContext: RequestPipelineContext;
    readonly _requestFilterRule: RequestFilterRule;
    readonly opts: ConfigureResponseEventOptions;

    constructor (requestContext: RequestPipelineContext, requestFilterRule: RequestFilterRule, opts: ConfigureResponseEventOptions) {
        this._requestContext    = requestContext;
        this._requestFilterRule = requestFilterRule;
        this.opts               = opts;
    }

    setHeader (name: string, value: string) {
        this._requestContext.destRes.headers[name.toLowerCase()] = value;
    }

    removeHeader (name: string) {
        delete this._requestContext.destRes.headers[name.toLowerCase()];
    }
}
