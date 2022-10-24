import { RequestInfo, ResponseInfo } from '../info';
import RequestOptions from '../../../request-options';
import ConfigureResponseEvent from '../configure-response-event';
import RequestFilterRule from '../../request-filter-rule';


export default abstract class BaseRequestHookEventFactory {
    public abstract createRequestInfo (): RequestInfo;
    public abstract createRequestOptions (): RequestOptions;
    public abstract createConfigureResponseEvent (rule: RequestFilterRule): ConfigureResponseEvent;
    public abstract createResponseInfo (): ResponseInfo;
}
