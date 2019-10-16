// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { Node } from 'estree';
import transformers from './transformers';
import jsProtocolLastExpression from './transformers/js-protocol-last-expression';
import staticImportTransformer from './transformers/static-import';
import dynamicImportTransformer from './transformers/dynamic-import';
import replaceNode from './transformers/replace-node';
import { Syntax } from 'esotope-hammerhead';
import { parseProxyUrl } from '../../utils/url';

export interface CodeChange {
    start: number;
    end: number;
    index: number;
    parent: Node;
    key: keyof this['parent'];
}

class State {
    hasTransformedAncestor: boolean = false;
    newExpressionAncestor?: Node;
    newExpressionAncestorParent?: Node;
    newExpressionAncestorKey?: keyof this['newExpressionAncestorParent'];

    // NOTE: There is an issue with processing `new` expressions. `new a.src.b()` will be transformed
    // to `new __get$(a, 'src').b()`, which is wrong. The correct result is `new (__get$(a, 'src')).b()`.
    // To solve this problem, we add a 'state' entity. This entity stores the "new" expression, so that
    // we can add it to the changes when the transformation is found.
    static create<T extends Node> (currState: State, node: Node, parent?: T, key?: keyof T, hasTransformedAncestor: boolean = false): State {
        const isNewExpression         = node.type === Syntax.NewExpression;
        const isNewExpressionAncestor = isNewExpression && !currState.newExpressionAncestor;
        const newState                = new State();

        newState.hasTransformedAncestor      = currState.hasTransformedAncestor || hasTransformedAncestor;
        newState.newExpressionAncestor       = isNewExpressionAncestor ? node : currState.newExpressionAncestor;
        newState.newExpressionAncestorParent = isNewExpressionAncestor ? parent : currState.newExpressionAncestorParent;
        // @ts-ignore
        newState.newExpressionAncestorKey    = isNewExpressionAncestor ? key : currState.newExpressionAncestorKey;

        return newState;
    }
}

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const objectToString = Object.prototype.toString;
const objectKeys     = Object.keys;

function getChange<T extends Node> (node: Node, parent: T, key: keyof T): CodeChange {
    /*eslint-disable @typescript-eslint/no-non-null-assertion*/
    const start = node.originStart!;
    const end   = node.originEnd!;
    const nodes = parent[key];
    const index = nodes instanceof Array ? nodes.indexOf(node) : -1;
    /*eslint-disable @typescript-eslint/no-non-null-assertion*/

    // @ts-ignore
    return { start, end, index, parent, key };
}

function transformChildNodes (node: Node, changes: CodeChange[], state: State) {
    // @ts-ignore
    const nodeKeys: (keyof Node)[] = objectKeys(node);

    for (const key of nodeKeys) {
        const childNode       = node[key];
        const stringifiedNode = objectToString.call(childNode);

        if (stringifiedNode === '[object Array]') {
            // @ts-ignore
            const childNodes = childNode as Node[];

            for (const nthNode of childNodes)
                transform(nthNode, changes, state, node, key);
        }
        else if (stringifiedNode === '[object Object]') {
            // @ts-ignore
            transform(childNode!, changes, state, node, key);
        }
    }
}

function isNodeTransformed (node: Node): boolean {
    return node.originStart !== void 0 && node.originEnd !== void 0;
}

function addChangeForTransformedNode<T extends Node> (state: State, changes: CodeChange[], replacement: Node, parent: T, key: keyof T) {
    const hasTransformedAncestor = state.hasTransformedAncestor ||
                                   state.newExpressionAncestor && isNodeTransformed(state.newExpressionAncestor);

    if (hasTransformedAncestor)
        return;

    if (state.newExpressionAncestor) {
        replaceNode(state.newExpressionAncestor, state.newExpressionAncestor, state.newExpressionAncestorParent!, state.newExpressionAncestorKey!);
        changes.push(getChange(state.newExpressionAncestor, state.newExpressionAncestorParent!, state.newExpressionAncestorKey!));
    }
    else
        changes.push(getChange(replacement, parent, key));
}

export function beforeTransform (wrapLastExprWithProcessHtml: boolean = false, resolver?: Function) {
    jsProtocolLastExpression.wrapLastExpr = wrapLastExprWithProcessHtml;
    staticImportTransformer.resolver = resolver;

    if (resolver)
        dynamicImportTransformer.baseUrl = parseProxyUrl(resolver('./'))!.destUrl;
}

export function afterTransform () {
    jsProtocolLastExpression.wrapLastExpr = false;
    staticImportTransformer.resolver = void 0;
    dynamicImportTransformer.baseUrl = void 0;
}

/* eslint-disable @typescript-eslint/indent */
export default function transform<T extends Node> (node: Node,
                                                   changes: CodeChange[] = [],
                                                   state: State = new State(),
                                                   parent?: T,
                                                   key?: keyof T,
                                                   reTransform?: boolean): CodeChange[] {
    /* eslint-enable @typescript-eslint/indent */

    if (!node || typeof node !== 'object')
        return changes;

    let nodeChanged = false;

    if (isNodeTransformed(node) && !reTransform) {
        addChangeForTransformedNode(state, changes, node, parent!, key!);
        nodeChanged = true;
    }

    else if (transformers.has(node.type)) {
        const nodeTransformers = transformers.get(node.type)!;

        for (const transformer of nodeTransformers) {
            if (!transformer.condition(node, parent))
                continue;

            const replacement = transformer.run(node, parent, key);

            if (!replacement)
                continue;

            replaceNode(node, replacement, parent!, key!);
            addChangeForTransformedNode(state, changes, replacement, parent!, key!);

            nodeChanged = true;

            if (!transformer.nodeReplacementRequireTransform)
                break;

            state = State.create(state, replacement, parent!, key!, nodeChanged);

            transform(replacement, changes, state, parent, key, true);

            return changes;
        }
    }

    state = State.create(state, node, parent, key, nodeChanged);

    transformChildNodes(node, changes, state);

    return changes;
}
