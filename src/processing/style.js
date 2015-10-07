// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { IS_STYLESHEET_PROCESSED_COMMENT, HOVER_PSEUDO_CLASS_ATTR } from '../const';

const IS_STYLESHEET_PROCESSED_REG_EX = new RegExp('^\\s*' + IS_STYLESHEET_PROCESSED_COMMENT
        .replace(/\/|\*/g, '\\$&'));

const SOURCE_MAP_REG_EX              = /#\s*sourceMappingURL\s*=\s*[^\s]+(\s|\*\/)/i;
const CSS_URL_PROPERTY_VALUE_PATTERN = /(url\s*\(\s*)(?:(')([^\s']*)(')|(")([^\s"]*)(")|([^\s\)]*))(\s*\))|(@import\s+)(?:(')([^\s']*)(')|(")([^\s"]*)("))/g;

class StyleProcessor {
    process (css, urlReplacer, isStylesheetTable) {
        var isStylesheetProcessed = IS_STYLESHEET_PROCESSED_REG_EX.test(css);

        if (typeof css === 'string' && !isStylesheetProcessed) {
            var prefix = isStylesheetTable ? IS_STYLESHEET_PROCESSED_COMMENT + '\n' : '';

            // Replace :hover pseudo class
            css = css.replace(/\s*:\s*hover(\W)/gi, '[' + HOVER_PSEUDO_CLASS_ATTR + ']$1');

            // Remove source map directive
            css = css.replace(SOURCE_MAP_REG_EX, '$1');

            // NOTE: replace URLs in css rules with the proxy URLs.
            return prefix + this._replaceStylsheetUrls(css, urlReplacer);
        }

        return css;
    }

    cleanUp (css, parseProxyUrl, formatUrl) {
        if (typeof css === 'string') {
            css = css.replace(new RegExp('\\[' + HOVER_PSEUDO_CLASS_ATTR + '\\](\\W)', 'ig'), ':hover$1');

            return this._replaceStylsheetUrls(css, url => {
                var originUrlObj = parseProxyUrl(url);

                if (originUrlObj)
                    return formatUrl(originUrlObj.originResourceInfo);

                return url;
            });
        }

        return css;
    }

    _replaceStylsheetUrls (css, processor) {
        return css.replace(
            CSS_URL_PROPERTY_VALUE_PATTERN,
            (match, prefix1, openQuote1, url1, closeQuote1, openQuote2, url2, closeQuote2, url3, postfix,
             prefix2, openQuote3, url4, closeQuote3, openQuote4, url5, closeQuote4) => {
                var prefix     = prefix1 || prefix2;
                var openQuote  = openQuote1 || openQuote2 || openQuote3 || openQuote4 || '';
                var url        = url1 || url2 || url3 || url4 || url5;
                var closeQuote = closeQuote1 || closeQuote2 || closeQuote3 || closeQuote4 || '';

                postfix = postfix || '';

                return url ? prefix + openQuote + processor(url) + closeQuote + postfix : match;
            }
        );
    }
}

export default new StyleProcessor();
