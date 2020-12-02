import { RequestInfo } from '../../session/events/info';
import { Predicate, ObjectInitializer } from '../../typings/request-filter-rule';
import { PredicateOptions, ObjectOptions, RequestFilterRuleOptions } from './request-filter-options';

const MATCH_ANY_REQUEST_REG_EX = /.*/;

export default class RequestFilterRule {
    private readonly options: RequestFilterRuleOptions;

    constructor (options: string | RegExp | Predicate | ObjectInitializer) {
        this.options = typeof options === 'function' ?
            PredicateOptions(options) :
            new ObjectOptions(options);
    }

    async match (requestInfo: RequestInfo): Promise<boolean> {
        return this.options.match(requestInfo, this);
    }

    static get ANY (): RequestFilterRule {
        return new RequestFilterRule(MATCH_ANY_REQUEST_REG_EX);
    }

    static isANY (instance: any): boolean {
        return !!(instance &&
            instance.options &&
            instance.options.url === MATCH_ANY_REQUEST_REG_EX);
    }

    toString (): string {
        return this.options.toString();
    }
}
