import { default as css, Rule, Comment, AtRule, Document, Host, Media, Supports } from 'css';
import SHADOW_UI_CLASS_NAME from './class-name';

const ID_OR_CLASS_RE: RegExp          = /#[a-zA-Z0-9_-]+|\.-?[a-zA-Z0-9_][a-zA-Z0-9_-]*/g;
const ADD_POSTFIX_REPLACEMENT: string = '$&' + SHADOW_UI_CLASS_NAME.postfix;

function transformSelector (selector: string): string {
    return selector.replace(ID_OR_CLASS_RE, ADD_POSTFIX_REPLACEMENT);
}

function addUIClassPostfix (rules: Array<Rule|Comment|AtRule>) {
    for (const node of rules) {
        if (node.type === 'rule') {
            const rule = <Rule>node;

            rule.selectors = rule.selectors && rule.selectors.map(transformSelector);
        }

        const nodeWithRules = <Document|Host|Media|Supports>node;

        if (nodeWithRules.rules)
            addUIClassPostfix(nodeWithRules.rules);
    }
}

export default function createShadowStylesheet (cssCode: string) {
    const ast = css.parse(cssCode, { silent: true });

    if (ast.stylesheet)
        addUIClassPostfix(ast.stylesheet.rules);

    return css.stringify(ast, { compress: false });
}
