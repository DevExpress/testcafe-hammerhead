import {
    isRegExp,
    isString,
    isObject,
    castArray,
} from 'lodash';

import { RequestFilterRuleInit, RequestFilterRuleObjectInitializer } from './rule-init';
import generateUniqueId from '../../../utils/generate-unique-id';
import stringifyRule from './stringify';
import isPredicate from '../is-predicate';

const DEFAULT_OPTIONS: Partial<RequestFilterRuleObjectInitializer> = {
    url:    void 0,
    method: void 0,
    isAjax: void 0,
};

const MATCH_ANY_REQUEST_REG_EX = /.*/;

// NOTE: RequestFilterRule is a data transfer object
// It should contain only initialization and creation logic
export default class RequestFilterRule {
    public options: RequestFilterRuleInit;
    public id: string;
    public isPredicate: boolean;

    constructor (init: RequestFilterRuleInit) {
        this.options     = this._initializeOptions(init);
        this.id          = this._initializeId(init, this.options);
        this.isPredicate = isPredicate(this.options);
    }

    private _initializeOptions (init: RequestFilterRuleInit): RequestFilterRuleObjectInitializer {
        let tmpOptions   = Object.assign({}, DEFAULT_OPTIONS) as any;
        const optionType = typeof init;

        if (optionType === 'string' || isRegExp(init))
            tmpOptions.url = init;
        else if (optionType === 'function')
            tmpOptions = init;
        else if (optionType === 'object') {
            if ('options' in (init as any))
                return this._initializeOptions(init['options']);

            tmpOptions = Object.assign(tmpOptions, init);
        }
        else
            throw new TypeError('Wrong options have been passed to a request filter rule constructor.');

        this._ensureLowerCasedMethod(tmpOptions);

        return tmpOptions;
    }

    private _ensureLowerCasedMethod (opts: any): void {
        if (typeof opts.method === 'string')
            opts.method = opts.method.toLowerCase();
    }

    private _initializeId (originInit: RequestFilterRuleInit, preparedInit: RequestFilterRuleInit): string {
        const originId = originInit['id'];

        if (isString(originId))
            return originId;

        let id = generateUniqueId();

        if (isObject(preparedInit) && isString(preparedInit['id'])) {
            id = preparedInit['id'];

            delete preparedInit['id'];
        }

        return id;
    }

    private static _ensureRule (rule: RequestFilterRuleInit | RequestFilterRule) {
        if (rule instanceof RequestFilterRule)
            return rule;

        return new RequestFilterRule(rule);
    }

    static get ANY (): RequestFilterRule {
        return new RequestFilterRule(MATCH_ANY_REQUEST_REG_EX);
    }

    static isANY (instance: any): boolean {
        return !!(instance &&
            instance.options &&
            instance.options.url === MATCH_ANY_REQUEST_REG_EX);
    }

    static from (rule?: RequestFilterRuleInit): RequestFilterRule | null {
        if (!rule)
            return null;

        return this._ensureRule(rule);
    }

    static fromArray (rules?: RequestFilterRuleInit[]): RequestFilterRule[] {
        if (!rules)
            return [];

        const ruleArr = castArray(rules);

        return ruleArr.map(rule => this._ensureRule(rule));
    }

    toString (): string {
        return stringifyRule(this);
    }
}
