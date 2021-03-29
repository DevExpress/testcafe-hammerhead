import { isRegExp, isString, isObject, castArray } from 'lodash';
import { RequestFilterRuleInit } from './rule-init';
import generateUniqueId from '../../../utils/generate-unique-id';
import stringifyRule from './stringify';
import { RequestFilterRuleObjectInitializer } from './rule-init';

const DEFAULT_OPTIONS: RequestFilterRuleObjectInitializer = {
    url:    void 0,
    method: void 0,
    isAjax: void 0
};

const MATCH_ANY_REQUEST_REG_EX = /.*/;

// NOTE: RequestFilterRule is a data transfer object
// It should contain only initialization and creation logic
export default class RequestFilterRule {
    public readonly options: RequestFilterRuleInit;
    public id: string;

    constructor (options: RequestFilterRuleInit) {
        this.options = this._initializeOptions(options);
        this.id      = this._initializeId(this.options);
    }

    private _initializeOptions (options: RequestFilterRuleInit): RequestFilterRuleObjectInitializer {
        let tmpOptions: any = Object.assign({}, DEFAULT_OPTIONS);

        if (typeof options === 'string' || isRegExp(options))
            tmpOptions.url = options;
        else if (typeof options === 'function')
            tmpOptions = options;
        else if (typeof options === 'object')
            tmpOptions = Object.assign(tmpOptions, options);
        else
            throw new TypeError('Wrong options have been passed to a request filter.');

        if (typeof tmpOptions.method === 'string')
            tmpOptions.method = tmpOptions.method.toLowerCase();

        return tmpOptions;
    }

    private _initializeId (options: RequestFilterRuleInit): string {
        let id = generateUniqueId();

        if (isObject(options) && isString(options['id'])) {
            id = options['id'];

            delete options['id'];
        }

        return id;
    }

    private static _ensureRule (rule: RequestFilterRuleInit | RequestFilterRule) {
        return rule instanceof RequestFilterRule ?
            rule :
            new RequestFilterRule(rule);
    }

    static get ANY (): RequestFilterRule {
        return new RequestFilterRule(MATCH_ANY_REQUEST_REG_EX);
    }

    static isANY (instance: any): boolean {
        return !!(instance &&
            instance.options &&
            instance.options.url === MATCH_ANY_REQUEST_REG_EX);
    }

    static from (rules?: RequestFilterRuleInit | RequestFilterRuleInit[]): RequestFilterRule[] {
        if (!rules)
            return [];

        const ruleArr = castArray(rules);

        return ruleArr.map(rule => this._ensureRule(rule));
    }

    toString (): string {
        return stringifyRule(this);
    }
}
