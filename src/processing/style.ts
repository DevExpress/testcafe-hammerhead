// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

import reEscape from '../utils/regexp-escape';
import INTERNAL_ATTRS from '../processing/dom/internal-attributes';
import { isSpecialPage } from '../utils/url';

const SOURCE_MAP_RE                       = /(?:\/\*\s*(?:#|@)\s*sourceMappingURL\s*=[\s\S]*?\*\/)|(?:\/\/[\t ]*(?:#|@)[\t ]*sourceMappingURL[\t ]*=.*)/ig;
const CSS_URL_PROPERTY_VALUE_PATTERN      = /(url\s*\(\s*)(?:(')([^\s']*)(')|(")([^\s"]*)(")|([^\s)]*))(\s*\))|(@import\s+)(?:(')([^\s']*)(')|(")([^\s"]*)("))/g;
const STYLESHEET_PROCESSING_START_COMMENT = '/*hammerhead|stylesheet|start*/';
const STYLESHEET_PROCESSING_END_COMMENT   = '/*hammerhead|stylesheet|end*/';
const HOVER_PSEUDO_CLASS_RE               = /:\s*hover(\W)/gi;
const PSEUDO_CLASS_RE                     = new RegExp(`\\[${ INTERNAL_ATTRS.hoverPseudoClass }\\](\\W)`, 'ig');
const IS_STYLE_SHEET_PROCESSED_RE         = new RegExp(`\\s*${ reEscape(STYLESHEET_PROCESSING_START_COMMENT) }`, 'gi');
const STYLESHEET_PROCESSING_COMMENTS_RE   = new RegExp(`${ reEscape(STYLESHEET_PROCESSING_START_COMMENT) }\n?|` +
                                                       `\n?${ reEscape(STYLESHEET_PROCESSING_END_COMMENT) }\\s*`, 'gi');

class StyleProcessor {
    STYLESHEET_PROCESSING_START_COMMENT: string = STYLESHEET_PROCESSING_START_COMMENT;
    STYLESHEET_PROCESSING_END_COMMENT: string = STYLESHEET_PROCESSING_END_COMMENT;

    process (css: string, urlReplacer: Function, shouldIncludeProcessingComments?: boolean): string {
        if (!css || typeof css !== 'string' || shouldIncludeProcessingComments && IS_STYLE_SHEET_PROCESSED_RE.test(css))
            return css;

        // NOTE: Replace the :hover pseudo-class.
        css = css.replace(HOVER_PSEUDO_CLASS_RE, '[' + INTERNAL_ATTRS.hoverPseudoClass + ']$1');

        // NOTE: Remove all 'source map' directives.
        css = css.replace(SOURCE_MAP_RE, '');

        // NOTE: Replace URLs in CSS rules with proxy URLs.
        css = this._replaceStylsheetUrls(css, urlReplacer);

        if (shouldIncludeProcessingComments)
            css = `${STYLESHEET_PROCESSING_START_COMMENT}\n${css}\n${STYLESHEET_PROCESSING_END_COMMENT}`;

        return css;
    }

    cleanUp (css: string, parseProxyUrl: Function): string {
        if (typeof css !== 'string')
            return css;

        css = css
            .replace(PSEUDO_CLASS_RE, ':hover$1');

        css = this._removeStylesheetProcessingComments(css);

        return this._replaceStylsheetUrls(css, (url: string) => {
            const parsedProxyUrl = parseProxyUrl(url);

            return parsedProxyUrl ? parsedProxyUrl.destUrl : url;
        });
    }

    _removeStylesheetProcessingComments (css: string): string {
        const parts = css.split(STYLESHEET_PROCESSING_COMMENTS_RE);

        for (let i = 0; i < parts.length; i += 2) {
            let whiteSpaceCount = 0;

            // NOTE: search for whitespaces from the end of the string
            // we do not use /\s*$/ regex intentionally to improve performance
            for (let j = parts[i].length - 1; j >= 0; j--) {
                if (!(/\s/.test(parts[i][j])))
                    break;

                whiteSpaceCount++;
            }

            parts[i] = parts[i].substring(0, parts[i].length - whiteSpaceCount);
        }


        return parts.join('');
    }

    _replaceStylsheetUrls (css: string, processor: Function): string {
        return css.replace(
            CSS_URL_PROPERTY_VALUE_PATTERN,
            (match, prefix1, openQuote1, url1, closeQuote1, openQuote2, url2, closeQuote2, url3, postfix,
                prefix2, openQuote3, url4, closeQuote3, openQuote4, url5, closeQuote4) => {
                const prefix     = prefix1 || prefix2;
                const openQuote  = openQuote1 || openQuote2 || openQuote3 || openQuote4 || '';
                const url        = url1 || url2 || url3 || url4 || url5;
                const closeQuote = closeQuote1 || closeQuote2 || closeQuote3 || closeQuote4 || '';

                postfix = postfix || '';

                const processedUrl = isSpecialPage(url) ? url : processor(url);

                return url ? prefix + openQuote + processedUrl + closeQuote + postfix : match;
            }
        );
    }
}

export default new StyleProcessor();
