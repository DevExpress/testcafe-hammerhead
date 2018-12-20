// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { createGetEvalMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';
import replaceNode from './replace-node';
// Transform:
// foo = eval.bind(...); -->
// foo = __get$Eval(eval).bind(...);
export default {
    nodeReplacementRequireTransform: false,
    nodeTypes: [Syntax.CallExpression],
    condition: node => {
        if (node.callee.type === Syntax.MemberExpression && node.callee.property.name === 'bind') {
            const obj = node.callee.object;
            // obj.eval.bind(), obj[eval].bind(),
            if (obj.type === Syntax.MemberExpression && (obj.property.value || obj.property.name) === 'eval')
                return true;
            // eval.bind()
            if (obj.name === 'eval')
                return true;
        }
        return false;
    },
    run: node => {
        const getEvalNode = createGetEvalMethCall(node.callee.object);
        replaceNode(node.callee.object, getEvalNode, node.callee, 'object');
        return null;
    }
};
