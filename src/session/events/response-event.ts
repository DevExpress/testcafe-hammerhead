/*eslint-disable no-unused-vars*/
import RequestFilterRule from '../../request-pipeline/request-hooks/request-filter-rule';
import { PreparedResponseInfo } from './info';
/*eslint-enable no-unused-vars*/

export default class ResponseEvent {
    readonly _requestFilterRule: RequestFilterRule;
    readonly requestId: string;
    readonly statusCode: number;
    readonly sessionId: string;
    readonly headers?: { [name: string]: string|Array<string> };
    readonly body?: Buffer;

    constructor (requestFilterRule: RequestFilterRule, preparedResponseInfo: PreparedResponseInfo) {
        this._requestFilterRule = requestFilterRule;

        this.requestId  = preparedResponseInfo.requestId;
        this.statusCode = preparedResponseInfo.statusCode;
        this.sessionId  = preparedResponseInfo.sessionId;

        if (preparedResponseInfo.headers)
            this.headers = preparedResponseInfo.headers;

        if (preparedResponseInfo.body)
            this.body = preparedResponseInfo.body;
    }
}
