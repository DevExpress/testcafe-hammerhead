import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import RequestPipelineContext from '../../request-pipeline/context';
import ConfigureResponseEventOptions from './configure-response-event-options';
import generateUniqueId from '../../utils/generate-unique-id';

export default class ConfigureResponseEvent {
    public readonly requestFilterRule: RequestFilterRule;
    private readonly _requestContext: RequestPipelineContext;
    public opts: ConfigureResponseEventOptions;
    public id: string;

    constructor (requestFilterRule: RequestFilterRule, requestContext: RequestPipelineContext, opts: ConfigureResponseEventOptions) {
        this.requestFilterRule  = requestFilterRule;
        this._requestContext    = requestContext;
        this.opts               = opts;
        this.id                 = generateUniqueId();
    }

    async setHeader (name: string, value: string): Promise<void> {
        this._requestContext.destRes.headers[name.toLowerCase()] = value;
    }

    async removeHeader (name: string): Promise<void> {
        delete this._requestContext.destRes.headers[name.toLowerCase()];
    }
}
