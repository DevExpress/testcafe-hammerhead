// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/*eslint-disable no-unused-vars*/
import { BaseNode, Node } from 'estree';
/*eslint-enable no-unused-vars*/
import transformers from './transformers';
import replaceNode from './transformers/replace-node';
import { Syntax } from 'esotope-hammerhead';

export interface CodeChange {
    start: number;
    end: number;
    index: number;
    parent: Node;
    key: string;
}

export class State {
    hasTransformedAncestor: boolean = false;
    newExpressionAncestor: Node;
    newExpressionAncestorParent: Node;
    newExpressionAncestorKey: string;

    // NOTE: There is an issue with processing `new` expressions. `new a.src.b()` will be transformed
    // to `new __get$(a, 'src').b()`, which is wrong. The correct result is `new (__get$(a, 'src')).b()`.
    // To solve this problem, we add a 'state' entity. This entity stores the "new" expression, so that
    // we can add it to the changes when the transformation is found.
    static create (currState: State, node: Node, parent: Node, key: string, hasTransformedAncestor: boolean): State {
        const isNewExpression         = node.type === Syntax.NewExpression;
        const isNewExpressionAncestor = isNewExpression && !currState.newExpressionAncestor;
        const newState                = new State();

        newState.hasTransformedAncestor      = currState.hasTransformedAncestor || hasTransformedAncestor;
        newState.newExpressionAncestor       = isNewExpressionAncestor ? node : currState.newExpressionAncestor;
        newState.newExpressionAncestorParent = isNewExpressionAncestor ? parent : currState.newExpressionAncestorParent;
        newState.newExpressionAncestorKey    = isNewExpressionAncestor ? key : currState.newExpressionAncestorKey;

        return newState;
    }
}

export interface NodeWithLocation extends BaseNode {
    start: number;
    end: number;
    originStart: number;
    originEnd: number;
}

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const objectToString: Function       = Object.prototype.toString;
const objectHasOwnProperty: Function = Object.prototype.hasOwnProperty;

function getChange (node: Node, parent: Node, key: string): CodeChange {
    const { originStart: start, originEnd: end } = <NodeWithLocation>node;
    const index = Array.isArray(parent[key]) ? parent[key].indexOf(node) : -1;

    return { start, end, index, parent, key };
}

function transformChildNodes (node, changes: Array<CodeChange>, state: State) {
    for (const key in node) {
        if (objectHasOwnProperty.call(node, key)) {
            const childNode       = node[key];
            const stringifiedNode = objectToString.call(childNode);

            if (stringifiedNode === '[object Array]') {
                for (let j = 0; j < childNode.length; j++)
                    transform(childNode[j], changes, state, node, key);
            }
            else if (stringifiedNode === '[object Object]')
                transform(childNode, changes, state, node, key);
        }
    }
}

function isNodeTransformed (node: Node): boolean {
    // eslint-disable-next-line no-extra-parens
    return (<NodeWithLocation>node).originStart !== void 0 && (<NodeWithLocation>node).originEnd !== void 0;
}

function addChangeForTransformedNode (state: State, changes: Array<CodeChange>, replacement: Node, parent: Node, key: string) {
    const hasTransformedAncestor = state.hasTransformedAncestor ||
                                   state.newExpressionAncestor && isNodeTransformed(state.newExpressionAncestor);

    if (hasTransformedAncestor)
        return;

    if (state.newExpressionAncestor) {
        replaceNode(state.newExpressionAncestor, state.newExpressionAncestor, state.newExpressionAncestorParent, state.newExpressionAncestorKey);
        changes.push(getChange(state.newExpressionAncestor, state.newExpressionAncestorParent, state.newExpressionAncestorKey));
    }
    else
        changes.push(getChange(replacement, parent, key));
}

export default function transform (node: Node, changes: Array<CodeChange> = [], state: State = new State(), parent?: Node, key?: string, reTransform?: boolean) {
    if (!node || typeof node !== 'object')
        return null;

    let nodeChanged = false;

    if (isNodeTransformed(node) && !reTransform) {
        addChangeForTransformedNode(state, changes, node, parent, key);
        nodeChanged = true;
    }
    else {
        const nodeTransformers = transformers.get(<Syntax>node.type);

        if (nodeTransformers) {
            for (let i = 0; i < nodeTransformers.length; i++) {
                const transformer = nodeTransformers[i];

                if (transformer.condition(node, parent)) {
                    const replacement = transformer.run(node, parent, key);

                    if (replacement) {
                        replaceNode(node, replacement, parent, key);
                        nodeChanged = true;

                        addChangeForTransformedNode(state, changes, replacement, parent, key);

                        if (transformer.nodeReplacementRequireTransform) {
                            state = State.create(state, replacement, parent, key, nodeChanged);

                            transform(replacement, changes, state, parent, key, true);

                            return changes;
                        }

                        break;
                    }
                }
            }
        }
    }

    state = State.create(state, node, parent, key, nodeChanged);

    transformChildNodes(node, changes, state);

    return changes;
}
