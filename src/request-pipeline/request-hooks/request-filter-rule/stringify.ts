import RequestFilterRule from './index';
import { isString, isFunction } from 'lodash';
import { RequestFilterRuleObjectInitializer } from './rule-init';

const STRINGIFIED_FUNCTION_OPTIONS = '{ <predicate> }';

function stringifyObjectOptions (rule: RequestFilterRule) {
    const ruleOptions = rule.options as RequestFilterRuleObjectInitializer;

    const stringifiedOptions = [
        { name: 'url', value: ruleOptions.url },
        { name: 'method', value: ruleOptions.method },
        { name: 'isAjax', value: ruleOptions.isAjax },
    ];

    const msg = stringifiedOptions.filter(option => !!option.value)
        .map(option => {
            const stringifiedOptionValue = isString(option.value) ? `"${option.value}"` : option.value;

            return `${option.name}: ${stringifiedOptionValue}`;
        })
        .join(', ');

    return `{ ${msg} }`;
}

export default function (rule: RequestFilterRule): string {
    return isFunction(rule.options) ? STRINGIFIED_FUNCTION_OPTIONS : stringifyObjectOptions(rule);
}
