import { isRegExp, isString } from 'lodash';
import { ensureOriginTrailingSlash } from '../../utils/url';
import { RequestInfo } from '../../session/events/info';
import { Options, Predicate } from '../../typings/request-filter-rule';

const DEFAULT_OPTIONS: Options = {
    url:    void 0,
    method: void 0,
    isAjax: void 0
};

const MATCH_ANY_REQUEST_REG_EX = /.*/;

const STRINGIFIED_FUNCTION_OPTIONS = '{ <predicate> }';

export default class RequestFilterRule {
    private readonly options: Options | Predicate;

    constructor (options: string | RegExp | Predicate | Options) {
        this.options = this._initializeOptions(options);
    }

    _initializeOptions (options: string | RegExp | Predicate | Options) {
        let tmpOptions: Options | Predicate = Object.assign({}, DEFAULT_OPTIONS);

        if (typeof options === 'string' || isRegExp(options))
            tmpOptions.url = options;
        else if (typeof options === 'function')
            tmpOptions = options;
        else if (typeof options === 'object') {
            tmpOptions = Object.assign(tmpOptions, options);

            if (typeof tmpOptions.method === 'string')
                tmpOptions.method = tmpOptions.method.toLowerCase();
        }
        else
            throw new TypeError('Wrong options have been passed to a request filter.');

        return tmpOptions;
    }

    _matchUrl (optionValue: any, checkedValue: any) {
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

    _matchMethod (optionValue: any, checkedValue: any) {
        if (optionValue === void 0)
            return true;

        if (typeof optionValue === 'string')
            return optionValue === checkedValue;

        return false;
    }

    _matchIsAjax (optionValue: any, checkedValue: any) {
        if (optionValue === void 0)
            return true;

        if (typeof optionValue === 'boolean')
            return optionValue === checkedValue;

        return false;
    }

    _matchUsingObjectOptions (requestInfo: RequestInfo) {
        const { url, method, isAjax } = this.options as Options;

        return this._matchUrl(url, requestInfo.url) &&
               this._matchMethod(method, requestInfo.method) &&
               this._matchIsAjax(isAjax, requestInfo.isAjax);
    }

    async _matchUsingFunctionOptions (requestInfo: RequestInfo): Promise<boolean> {
        const predicate = this.options as Predicate;

        return !!predicate.call(this, requestInfo);
    }

    _stringifyObjectOptions () {
        const { url, method, isAjax } = this.options as Options;

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

    async match (requestInfo: RequestInfo): Promise<boolean> {
        if (typeof this.options === 'function')
            return await this._matchUsingFunctionOptions(requestInfo);

        return this._matchUsingObjectOptions(requestInfo);
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
        const isFunctionOptions = typeof this.options === 'function';

        return isFunctionOptions ? STRINGIFIED_FUNCTION_OPTIONS : this._stringifyObjectOptions();
    }
}
