import { RequestInfo } from '../session/events/info';

export type Predicate = (requestInfo: RequestInfo) => boolean;

export type Options = {
    url?:    string | RegExp,
    method?: string,
    isAjax?: boolean
}
