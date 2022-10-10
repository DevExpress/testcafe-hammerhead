import { RequestInfo } from '../info';
import RequestOptions from '../../../request-options';


export default abstract class BaseRequestHookEventFactory {
    public abstract createRequestInfo (): RequestInfo;
    public abstract createRequestOptions (): RequestOptions;
}
