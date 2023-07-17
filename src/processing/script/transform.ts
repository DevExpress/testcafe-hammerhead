// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import {
    BlockStatement,
    Node,
    Program,
} from 'estree';

import transformers, { Transformer } from './transformers';
import jsProtocolLastExpression from './transformers/js-protocol-last-expression';
import staticImportTransformer from './transformers/static-import';
import dynamicImportTransformer from './transformers/dynamic-import';
import replaceNode from './transformers/replace-node';
import { Syntax } from 'esotope-hammerhead';
import { parseProxyUrl } from '../../utils/url';
import { getFirstDestUrl } from '../../utils/stack-processing';
import { createTempVarsDeclaration } from './node-builder';
import TempVariables from './transformers/temp-variables';

export interface CodeChange {
    start: number;
    end: number;
    node: Node;
    parentType: Node['type'];
}

class State {
    hasTransformedAncestor = false;
    newExpressionAncestor?: Node;
    newExpressionAncestorParent?: Node;
    newExpressionAncestorKey?: keyof this['newExpressionAncestorParent'];

    // NOTE: There is an issue with processing `new` expressions. `new a.src.b()` will be transformed
    // to `new __get$(a, 'src').b()`, which is wrong. The correct result is `new (__get$(a, 'src')).b()`.
    // To solve this problem, we add a 'state' entity. This entity stores the "new" expression, so that
    // we can add it to the changes when the transformation is found.
    static create<T extends Node> (currState: State, node: Node, parent?: T, key?: keyof T, hasTransformedAncestor = false): State {
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

function getChange (node: Node, parentType: Node['type']): CodeChange {
    /*eslint-disable @typescript-eslint/no-non-null-assertion*/
    const start = node.originStart!;
    const end   = node.originEnd!;
    /*eslint-disable @typescript-eslint/no-non-null-assertion*/

    return { start, end, node, parentType };
}

function transformChildNodes (node: Node, changes: CodeChange[], state: State, tempVars: TempVariables) {
    // @ts-ignore
    const nodeKeys: (keyof Node)[] = objectKeys(node);

    for (const key of nodeKeys) {
        const childNode       = node[key];
        const stringifiedNode = objectToString.call(childNode);

        if (stringifiedNode === '[object Array]') {
            // @ts-ignore
            const childNodes = childNode as Node[];

            for (const nthNode of childNodes) {
                // NOTE: Some items of ArrayExpression can be null
                if (nthNode)
                    transform(nthNode, changes, state, node, key, tempVars);
            }
        }
        else if (stringifiedNode === '[object Object]') {
            // @ts-ignore
            transform(childNode!, changes, state, node, key, tempVars);
        }
    }
}

function isNodeTransformed (node: Node): boolean {
    return node.originStart !== void 0 && node.originEnd !== void 0;
}

function addChangeForTransformedNode (state: State, changes: CodeChange[], replacement: Node, parentType: Node['type']) {
    const hasTransformedAncestor = state.hasTransformedAncestor ||
                                   state.newExpressionAncestor && isNodeTransformed(state.newExpressionAncestor);

    if (hasTransformedAncestor)
        return;

    if (state.newExpressionAncestor && state.newExpressionAncestorParent) {
        replaceNode(state.newExpressionAncestor, state.newExpressionAncestor, state.newExpressionAncestorParent!, state.newExpressionAncestorKey!);
        changes.push(getChange(state.newExpressionAncestor, state.newExpressionAncestorParent.type));
    }
    else
        changes.push(getChange(replacement, parentType));
}

function addTempVarsDeclaration (node: BlockStatement | Program, changes: CodeChange[], state: State, tempVars: TempVariables) {
    const names = tempVars.get();

    if (!names.length)
        return;

    const declaration = createTempVarsDeclaration(names);

    replaceNode(null, declaration, node, 'body');
    addChangeForTransformedNode(state, changes, declaration, node.type);
}

function beforeTransform (wrapLastExprWithProcessHtml = false, resolver?: Function) {
    jsProtocolLastExpression.wrapLastExpr = wrapLastExprWithProcessHtml;
    staticImportTransformer.resolver      = resolver;

    const isServerSide = typeof window === 'undefined';

    if (isServerSide) {
        dynamicImportTransformer.getBaseUrl = () => {
            if (typeof dynamicImportTransformer.baseUrl === 'undefined')
                dynamicImportTransformer.baseUrl = resolver ? parseProxyUrl(resolver('./'))!.destUrl : '';

            return dynamicImportTransformer.baseUrl;
        };
    }
    else {
        dynamicImportTransformer.getBaseUrl = () => {
            if (typeof dynamicImportTransformer.baseUrl === 'undefined') {
                const currentStack = new Error().stack;

                dynamicImportTransformer.baseUrl = currentStack && getFirstDestUrl(currentStack) || '';
            }

            return dynamicImportTransformer.baseUrl;
        };
    }
}

function afterTransform () {
    jsProtocolLastExpression.wrapLastExpr = false;
    staticImportTransformer.resolver      = void 0;
    dynamicImportTransformer.baseUrl      = void 0;
}

function findTransformer (node: Node, parent: Node): Transformer<any> | null {
    const nodeTransformers = transformers.get(node.type);

    if (nodeTransformers) {
        for (const transformer of nodeTransformers) {
            if (transformer.condition(node, parent))
                return transformer;
        }
    }

    return null;
}

function transform<T extends Node> (node: Node, changes: CodeChange[], state: State, parent: T, key: keyof T, tempVars: TempVariables) {
    const allowTempVarAdd = node.type === Syntax.BlockStatement;
    let nodeTransformed   = false;

    if (allowTempVarAdd)
        tempVars = new TempVariables();

    if (!node.reTransform && isNodeTransformed(node)) {
        addChangeForTransformedNode(state, changes, node, parent.type);
        nodeTransformed = true;
    }
    else {
        const storedNode = node;
        let transformer  = findTransformer(node, parent);
        let replacement  = null as Node | null;

        while (transformer) {
            replacement = transformer.run(replacement || node, parent, key, tempVars);

            if (!replacement)
                break;

            nodeTransformed = true;

            if (!transformer.nodeReplacementRequireTransform)
                break;

            transformer = findTransformer(replacement, parent);
            node        = replacement;
        }

        if (nodeTransformed && replacement) {
            replaceNode(storedNode, replacement, parent, key);
            addChangeForTransformedNode(state, changes, replacement, parent.type);
        }
    }

    state = State.create(state, node, parent, key, nodeTransformed);

    transformChildNodes(node, changes, state, tempVars);

    if (allowTempVarAdd)
        addTempVarsDeclaration(node as BlockStatement, changes, state, tempVars);
}

export default function transformProgram (node: Program, wrapLastExprWithProcessHtml = false, resolver?: Function): CodeChange[] {
    const changes  = [] as CodeChange[];
    const state    = new State();
    const tempVars = new TempVariables();

    TempVariables.resetCounter();
    beforeTransform(wrapLastExprWithProcessHtml, resolver);
    transformChildNodes(node, changes, state, tempVars);
    addTempVarsDeclaration(node, changes, state, tempVars);
    afterTransform();

    return changes;
}
