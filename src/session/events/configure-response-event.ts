import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import RequestPipelineContext from '../../request-pipeline/context';
import ConfigureResponseEventOptions from './configure-response-event-options';
import generateUniqueId from '../../utils/generate-unique-id';

interface SerializedConfigureResponseEvent {
    requestFilterRule: RequestFilterRule;
    _requestContext: RequestPipelineContext;
    opts: ConfigureResponseEventOptions;
    id: string;
}

export default class ConfigureResponseEvent {
    public readonly requestFilterRule: RequestFilterRule;
    private readonly _requestContext: RequestPipelineContext | null;
    public opts: ConfigureResponseEventOptions;
    public id: string;

    constructor (requestFilterRule: RequestFilterRule, requestContext: RequestPipelineContext | null, opts: ConfigureResponseEventOptions) {
        this.requestFilterRule  = requestFilterRule;
        this._requestContext    = requestContext;
        this.opts               = opts;
        this.id                 = generateUniqueId();
    }

    public async setHeader (name: string, value: string): Promise<void> {
        if (!this._requestContext)
            return;

        this._requestContext.destRes.headers[name.toLowerCase()] = value;
    }

    public async removeHeader (name: string): Promise<void> {
        if (!this._requestContext)
            return;

        delete this._requestContext.destRes.headers[name.toLowerCase()];
    }

    public static from (data: unknown): ConfigureResponseEvent {
        const { id, opts, requestFilterRule } = data as SerializedConfigureResponseEvent;

        const configureResponseEvent = new ConfigureResponseEvent(requestFilterRule, null, opts);

        configureResponseEvent.id = id;

        return configureResponseEvent;
    }
}
