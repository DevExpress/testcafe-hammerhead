import RequestFilterRule from '../request-filter-rule';
import RequestPipelineContext from '../../context';
import ConfigureResponseEventOptions from './configure-response-event-options';
import generateUniqueId from '../../../utils/generate-unique-id';

interface SerializedConfigureResponseEvent {
    requestFilterRule: RequestFilterRule;
    _requestContext: RequestPipelineContext;
    opts: ConfigureResponseEventOptions;
    id: string;
}

interface ModifyResponseFunctions {
    setHeader: (name: string, value: string) => void;
    removeHeader: (name: string) => void;
}

export default class ConfigureResponseEvent {
    public readonly requestFilterRule: RequestFilterRule;
    private readonly _modifyResponseFunctions: ModifyResponseFunctions | null;
    public opts: ConfigureResponseEventOptions;
    public id: string;

    constructor (requestFilterRule: RequestFilterRule, modifyResponseFunctions: ModifyResponseFunctions | null, opts = ConfigureResponseEventOptions.DEFAULT) {
        this.requestFilterRule        = requestFilterRule;
        this._modifyResponseFunctions = modifyResponseFunctions;
        this.opts                     = opts;
        this.id                       = generateUniqueId();
    }

    public async setHeader (name: string, value: string): Promise<void> {
        if (!this._modifyResponseFunctions)
            return;

        this._modifyResponseFunctions.setHeader(name, value);
    }

    public async removeHeader (name: string): Promise<void> {
        if (!this._modifyResponseFunctions)
            return;

        this._modifyResponseFunctions.removeHeader(name);
    }

    public static from (data: unknown): ConfigureResponseEvent {
        const { id, opts, requestFilterRule } = data as SerializedConfigureResponseEvent;

        const configureResponseEvent = new ConfigureResponseEvent(requestFilterRule, null, opts);

        configureResponseEvent.id = id;

        return configureResponseEvent;
    }
}
