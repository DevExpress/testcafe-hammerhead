import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import { PreparedResponseInfo } from './info';
import generateUniqueId from '../../utils/generate-unique-id';

export default class ResponseEvent {
    public requestFilterRule: RequestFilterRule;
    public readonly requestId: string;
    public readonly statusCode: number;
    public readonly sessionId: string;
    public readonly headers?: { [name: string]: string|string[] };
    public readonly body?: Buffer;
    public readonly isSameOriginPolicyFailed: boolean;
    public readonly id: string;

    constructor (requestFilterRule: RequestFilterRule, preparedResponseInfo: PreparedResponseInfo) {
        const {
            requestId,
            statusCode,
            sessionId,
            isSameOriginPolicyFailed,
            headers,
            body
        } = preparedResponseInfo;

        this.requestId                = requestId;
        this.statusCode               = statusCode;
        this.sessionId                = sessionId;
        this.isSameOriginPolicyFailed = isSameOriginPolicyFailed;
        this.headers                  = headers || this.headers;
        this.body                     = body || this.body;

        this.id                = generateUniqueId();
        this.requestFilterRule = requestFilterRule;
    }
}
