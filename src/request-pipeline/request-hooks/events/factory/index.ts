import BaseRequestHookEventFactory from './base';
import { RequestInfo } from '../info';
import RequestPipelineContext from '../../../context';


export default class RequestPipelineRequestHookEventFactory extends BaseRequestHookEventFactory {
    private readonly _ctx: RequestPipelineContext;

    public constructor (ctx: RequestPipelineContext) {
        super();

        this._ctx = ctx;
    }
    public createRequestInfo (): RequestInfo {
        return RequestInfo.from(this._ctx);
    }
}
