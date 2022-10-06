import { RequestInfo } from '../events/info';

export type RequestFilterRulePredicate = (requestInfo: RequestInfo) => boolean | Promise<boolean>;

export interface RequestFilterRuleObjectInitializer {
    id?: string;
    url: string | RegExp;
    method: string;
    isAjax: boolean;
}

export type RequestFilterRuleInit = string | RegExp | Partial<RequestFilterRuleObjectInitializer> | RequestFilterRulePredicate;
