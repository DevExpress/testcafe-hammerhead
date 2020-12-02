import { isRegExp, isString } from 'lodash';
import { ObjectInitializer, Predicate } from '../../typings/request-filter-rule';
import { RequestInfo } from '../../session/events/info';
import { ensureOriginTrailingSlash } from '../../utils/url';
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

    private static matchUrl (optionValue: string | RegExp | void, checkedValue: string) {
        if (optionValue === void 0)
            return true;

        if (typeof optionValue === 'string') {
            optionValue = ensureOriginTrailingSlash(optionValue);

            return optionValue === checkedValue;
        }

        else if (isRegExp(optionValue))
            return optionValue.test(checkedValue);

        return false;
    }

    private static matchMethod (optionValue: string | void, checkedValue: string) {
        if (optionValue === void 0)
            return true;

        if (typeof optionValue === 'string')
            return optionValue === checkedValue;

        return false;
    }

    private static matchIsAjax (optionValue: boolean | void, checkedValue: boolean) {
        if (optionValue === void 0)
            return true;

        if (typeof optionValue === 'boolean')
            return optionValue === checkedValue;

        return false;
    }

    async match (requestInfo: RequestInfo) {
        return ObjectOptions.matchUrl(this.url, requestInfo.url) &&
               ObjectOptions.matchMethod(this.method, requestInfo.method) &&
               ObjectOptions.matchIsAjax(this.isAjax, requestInfo.isAjax);
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

const predicatePrototype: RequestFilterRuleOptions = {
    match: async function (requestInfo: RequestInfo, rule: RequestFilterRule) {
        return !!await (this as unknown as Predicate).call(rule, requestInfo);
    },

    toString () {
        return STRINGIFIED_FUNCTION_OPTIONS;
    }
}

export function PredicateOptions (predicate: Predicate): RequestFilterRuleOptions {
    return Object.assign(predicate, predicatePrototype);
}
