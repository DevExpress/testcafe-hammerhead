import css from 'css';
import SHADOW_UI_CLASS_NAME from './class-name';

const ID_OR_CLASS_RE          = /#[a-zA-Z0-9_-]+|\.-?[a-zA-Z0-9_][a-zA-Z0-9_-]*/g;
const ADD_POSTFIX_REPLACEMENT = '$&' + SHADOW_UI_CLASS_NAME.postfix;

function transformSelector (selector) {
    return selector.replace(ID_OR_CLASS_RE, ADD_POSTFIX_REPLACEMENT);
}

function addUIClassPostfix (rules) {
    let ruleStack = rules.slice();

    while (ruleStack.length) {
        const rule = ruleStack.pop();

        if (rule.type === 'rule' && rule.selectors)
            rule.selectors = rule.selectors.map(transformSelector);

        if (rule.rules)
            ruleStack = ruleStack.concat(rule.rules);
    }
}

export default function createShadowStylesheet (cssCode) {
    const ast = css.parse(cssCode, { silent: true });

    addUIClassPostfix(ast.stylesheet.rules);

    return css.stringify(ast, {
        indent:   0,
        compress: false
    });
}
