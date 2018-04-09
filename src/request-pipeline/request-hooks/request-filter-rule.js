import { isRegExp } from 'lodash';
import { ensureOriginTrailingSlash } from '../../utils/url';

const DEFAULT_OPTIONS = {
    url:    void 0,
    method: void 0,
    isAjax: void 0
};

const MATCH_ANY_REQUEST_REG_EX = /.*/;

export default class RequestFilterRule {
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
        return this.options.call(this, requestInfo);
    }

    match (requestInfo) {
        if (this.options === 'function')
            return this._matchUsingFunctionOptions(requestInfo);

        return this._matchUsingObjectOptions(requestInfo);
    }

    static get ANY () {
        return new RequestFilterRule(MATCH_ANY_REQUEST_REG_EX);
    }
}
