import Const from '../const';

const IS_STYLESHEET_PROCESSED_REG_EX = new RegExp('^\\s*' + Const.IS_STYLESHEET_PROCESSED_COMMENT
        .replace(/\/|\*/g, '\\$&'));

const SOURCE_MAP_REG_EX              = /#\s*sourceMappingURL\s*=\s*[^\s]+(\s|\*\/)/i;
const CSS_URL_PROPERTY_VALUE_PATTERN = /(url\s*\(\s*)(?:(')([^\s']*)(')|(")([^\s"]*)(")|([^\s\)]*))(\s*\))|(@import\s+)(?:(')([^\s']*)(')|(")([^\s"]*)("))/g;

class StyleProcessor {
    process (css, urlReplacer, isStylesheetTable) {
        var isStylesheetProcessed = IS_STYLESHEET_PROCESSED_REG_EX.test(css);

        if (typeof css === 'string' && !isStylesheetProcessed) {
            var prefix = isStylesheetTable ? Const.IS_STYLESHEET_PROCESSED_COMMENT + '\n' : '';

            // Replace :hover pseudo class
            css = css.replace(/\s*:\s*hover(\W)/gi, '[' + Const.HOVER_PSEUDO_CLASS_ATTR + ']$1');

            // Remove source map directive
            css = css.replace(SOURCE_MAP_REG_EX, '$1');

            // NOTE: replace URLs in css rules with the proxy URLs.
            return prefix + this._replaceStylsheetUrls(css, urlReplacer);
        }

        return css;
    }

    cleanUp (css, parseProxyUrl, formatUrl) {
        if (typeof css === 'string') {
            css = css.replace(new RegExp('\\[' + Const.HOVER_PSEUDO_CLASS_ATTR + '\\](\\W)', 'ig'), ':hover$1');

            return this._replaceStylsheetUrls(css, function (url) {
                var originUrlObj = parseProxyUrl(url);

                if (originUrlObj)
                    return formatUrl(originUrlObj.originResourceInfo);

                return url;
            });
        }

        return css;
    }

    _replaceStylsheetUrls (css, processor) {
        return css.replace(CSS_URL_PROPERTY_VALUE_PATTERN, function () {
            var prefix     = arguments[1] || arguments[10];
            var openQuote  = arguments[2] || arguments[5] || arguments[11] || arguments[14] || '';
            var url        = arguments[3] || arguments[6] || arguments[8] || arguments[12] || arguments[15];
            var closeQuote = arguments[4] || arguments[7] || arguments[13] || arguments[16] || '';
            var postfix    = arguments[9] || '';

            return url ? prefix + openQuote + processor(url) + closeQuote + postfix : arguments[0];
        });
    }
}

export default new StyleProcessor();
