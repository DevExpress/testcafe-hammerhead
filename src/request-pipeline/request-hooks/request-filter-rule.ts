import { isRegExp, isString } from 'lodash';
import { ensureOriginTrailingSlash } from '../../utils/url';

const DEFAULT_OPTIONS = {
    url:    void 0,
    method: void 0,
    isAjax: void 0
};

const MATCH_ANY_REQUEST_REG_EX: RegExp = /.*/;

const STRINGIFIED_FUNCTION_OPTIONS: string = '{ <predicate> }';

export default class RequestFilterRule {
    options: any;

    constructor (options) {
        this.options = this._initializeOptions(options);
    }

    _initializeOptions (options) {
        let tmpOptions = Object.assign({}, DEFAULT_OPTIONS);

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

    _matchUrl (optionValue, checkedValue) {
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

    _matchMethod (optionValue, checkedValue) {
        if (optionValue === void 0)
            return true;

        if (typeof optionValue === 'string')
            return optionValue === checkedValue;

        return false;
    }

    _matchIsAjax (optionValue, checkedValue) {
        if (optionValue === void 0)
            return true;

        if (typeof optionValue === 'boolean')
            return optionValue === checkedValue;

        return false;
    }

    _matchUsingObjectOptions (requestInfo) {
        return this._matchUrl(this.options.url, requestInfo.url) &&
               this._matchMethod(this.options.method, requestInfo.method) &&
               this._matchIsAjax(this.options.isAjax, requestInfo.isAjax);
    }

    _matchUsingFunctionOptions (requestInfo) {
        return !!this.options.call(this, requestInfo);
    }

    _stringifyObjectOptions () {
        const stringifiedOptions = [
            { name: 'url', value: this.options.url },
            { name: 'method', value: this.options.method },
            { name: 'isAjax', value: this.options.isAjax }
        ];

        const msg = stringifiedOptions.filter(option => !!option.value)
            .map(option => {
                const stringifiedOptionValue = isString(option.value) ? `"${option.value}"` : option.value;

                return `${option.name}: ${stringifiedOptionValue}`;
            })
            .join(', ');

        return `{ ${msg} }`;
    }

    match (requestInfo) {
        if (typeof this.options === 'function')
            return this._matchUsingFunctionOptions(requestInfo);

        return this._matchUsingObjectOptions(requestInfo);
    }

    static get ANY () {
        return new RequestFilterRule(MATCH_ANY_REQUEST_REG_EX);
    }

    toString () {
        const isFunctionOptions = typeof this.options === 'function';

        return isFunctionOptions ? STRINGIFIED_FUNCTION_OPTIONS : this._stringifyObjectOptions();
    }
}
