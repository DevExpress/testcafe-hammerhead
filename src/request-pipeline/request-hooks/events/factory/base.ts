import { RequestInfo } from '../info';


export default abstract class BaseRequestHookEventFactory {
    public abstract createRequestInfo (): RequestInfo;
}
