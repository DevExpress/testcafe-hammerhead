import RequestFilterRule from './request-filter-rule';
import { RequestInfo } from './events/info';
import { ensureOriginTrailingSlash } from '../../utils/url';
import { isRegExp, isFunction } from 'lodash';
import { RequestFilterRuleObjectInitializer } from '../request-hooks/request-filter-rule/rule-init';

async function matchUsingFunctionOptions (rule: RequestFilterRule, requestInfo: RequestInfo): Promise<boolean> {
    return !!await (rule.options as Function).call(rule, requestInfo);
}

function matchUrl (optionValue: any, checkedValue: any): boolean {
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

function matchMethod (optionValue: any, checkedValue: any): boolean {
    if (optionValue === void 0)
        return true;

    if (typeof optionValue === 'string')
        return optionValue === checkedValue;

    return false;
}

function matchIsAjax (optionValue: any, checkedValue: any): boolean {
    if (optionValue === void 0)
        return true;

    if (typeof optionValue === 'boolean')
        return optionValue === checkedValue;

    return false;
}

function matchUsingObjectOptions (rule: RequestFilterRule, requestInfo: RequestInfo): boolean {
    const ruleOptions = rule.options as RequestFilterRuleObjectInitializer;

    return matchUrl(ruleOptions.url, requestInfo.url) &&
        matchMethod(ruleOptions.method, requestInfo.method) &&
        matchIsAjax(ruleOptions.isAjax, requestInfo.isAjax);
}

export default async function (rule: RequestFilterRule, requestInfo: RequestInfo): Promise<boolean> {
    if (isFunction(rule.options))
        return matchUsingFunctionOptions(rule, requestInfo);

    return matchUsingObjectOptions(rule, requestInfo);
}
