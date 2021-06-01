import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import { PreparedResponseInfo } from './info';
import generateUniqueId from '../../utils/generate-unique-id';
import { OutgoingHttpHeaders } from 'http';

interface SerializedResponseEvent {
    requestFilterRule: RequestFilterRule;
    id: string;
    requestId: string;
    statusCode: number;
    sessionId: string;
    isSameOriginPolicyFailed: boolean;
    headers?: OutgoingHttpHeaders;
    body?: Buffer;
}

export default class ResponseEvent {
    public requestFilterRule: RequestFilterRule;
    public readonly requestId: string;
    public readonly statusCode: number;
    public readonly sessionId: string;
    public readonly headers?: OutgoingHttpHeaders;
    public readonly body?: Buffer;
    public readonly isSameOriginPolicyFailed: boolean;
    public id: string;

    public constructor (requestFilterRule: RequestFilterRule, preparedResponseInfo: PreparedResponseInfo) {
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

    public static from (data: unknown): ResponseEvent {
        const {
            requestFilterRule,
            id,
            requestId,
            statusCode,
            sessionId,
            isSameOriginPolicyFailed,
            headers,
            body
        } = data as SerializedResponseEvent;

        const responseEvent = new ResponseEvent(requestFilterRule, {
            requestId,
            statusCode,
            sessionId,
            isSameOriginPolicyFailed,
            headers,
            body
        });

        responseEvent.id = id;

        return responseEvent;
    }
}
