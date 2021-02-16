import { isRegExp, isString } from 'lodash';
import { ObjectInitializer, Predicate } from '../../typings/request-filter-rule';
import { RequestInfo } from '../../session/events/info';
import { matchUrl, matchMethod, matchIsAjax } from './matchers';
import RequestFilterRule from './request-filter-rule';

export interface RequestFilterRuleOptions {
    match: (requestInfo: RequestInfo, rule?: RequestFilterRule) => Promise<boolean>;
    toString: () => string;
}

export class ObjectOptions implements RequestFilterRuleOptions {
    url?: string | RegExp = void 0;
    method?: string = void 0;
    isAjax?: boolean = void 0;

    constructor (initOptions: string | RegExp | ObjectInitializer) {
        if (typeof initOptions === 'string' || isRegExp(initOptions))
            this.url = initOptions;
        else if (typeof initOptions === 'object') {
            this.url = initOptions.url;
            this.method = initOptions.method;
            this.isAjax = initOptions.isAjax;

            if (typeof this.method === 'string')
                this.method = this.method.toLowerCase();
        }
    }

    async match (requestInfo: RequestInfo) {
        return matchUrl(this.url, requestInfo.url) &&
               matchMethod(this.method, requestInfo.method) &&
               matchIsAjax(this.isAjax, requestInfo.isAjax);
    }

    toString () {
        const { url, method, isAjax } = this;

        const stringifiedOptions = [
            { name: 'url', value: url },
            { name: 'method', value: method },
            { name: 'isAjax', value: isAjax }
        ];

        const msg = stringifiedOptions.filter(option => !!option.value)
            .map(option => {
                const stringifiedOptionValue = isString(option.value) ? `"${option.value}"` : option.value;

                return `${option.name}: ${stringifiedOptionValue}`;
            })
            .join(', ');

        return `{ ${msg} }`;
    }
}

const STRINGIFIED_FUNCTION_OPTIONS = '{ <predicate> }';

export class PredicateOptions implements RequestFilterRuleOptions {
    private predicate: Predicate;

    constructor (predicate: Predicate) {
        this.predicate = predicate;
    }

    async match (requestInfo: RequestInfo, rule: RequestFilterRule) {
        return !!this.predicate.call(rule, requestInfo);
    }

    toString () {
        return STRINGIFIED_FUNCTION_OPTIONS;
    }
}
