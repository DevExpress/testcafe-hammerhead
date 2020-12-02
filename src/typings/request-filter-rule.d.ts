import { RequestInfo } from '../session/events/info';

export type Predicate = (requestInfo: RequestInfo) => boolean | Promise<boolean>;

export type ObjectInitializer = {
    url?:    string | RegExp,
    method?: string,
    isAjax?: boolean
}
