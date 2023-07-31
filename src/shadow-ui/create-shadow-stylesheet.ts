import {
    default as css,
    CssRuleAST,
    CssCommentAST,
    CssAtRuleAST,
    CssDocumentAST,
    CssHostAST,
    CssMediaAST,
    CssSupportsAST,
} from '@adobe/css-tools';

import SHADOW_UI_CLASS_NAME from './class-name';

const ID_OR_CLASS_RE          = /#[a-zA-Z0-9_-]+|\.-?[a-zA-Z0-9_][a-zA-Z0-9_-]*/g;
const ADD_POSTFIX_REPLACEMENT = '$&' + SHADOW_UI_CLASS_NAME.postfix;

function transformSelector (selector: string): string {
    return selector.replace(ID_OR_CLASS_RE, ADD_POSTFIX_REPLACEMENT);
}

function addUIClassPostfix (rules: CssRuleAST[]|CssCommentAST[]|CssAtRuleAST[]): void {
    for (const node of rules) {
        if (node.type === 'rule') {
            const rule = node as CssRuleAST;

            rule.selectors = rule.selectors && rule.selectors.map(transformSelector);
        }

        const nodeWithRules = node as CssDocumentAST|CssHostAST|CssMediaAST|CssSupportsAST;

        if (nodeWithRules.rules)
            addUIClassPostfix(nodeWithRules.rules);
    }
}

export default function createShadowStylesheet (cssCode: string): string {
    const ast = css.parse(cssCode, { silent: true });

    if (ast.stylesheet)
        addUIClassPostfix(ast.stylesheet.rules);

    return css.stringify(ast, { compress: false });
}
