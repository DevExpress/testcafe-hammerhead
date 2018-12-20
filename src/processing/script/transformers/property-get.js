// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { createPropertyGetWrapper } from '../node-builder';
import { Syntax } from '../tools/esotope';
import { shouldInstrumentProperty } from '../instrumented';
// Transform:
// obj.<wrappable-property> -->
// __get$(obj, '<wrappable-property>')
export default {
    nodeReplacementRequireTransform: true,
    nodeTypes: [Syntax.MemberExpression],
    condition: (node, parent) => {
        if (node.computed)
            return false;
        if (!shouldInstrumentProperty(node.property.name))
            return false;
        // Skip: super.prop
        if (node.object.type === Syntax.Super)
            return false;
        // Skip: object.prop = value
        if (parent.type === Syntax.AssignmentExpression && parent.left === node)
            return false;
        // Skip: delete object.prop
        if (parent.type === Syntax.UnaryExpression && parent.operator === 'delete')
            return false;
        // Skip: object.prop()
        if (parent.type === Syntax.CallExpression && parent.callee === node)
            return false;
        // Skip: object.prop++ || object.prop-- || ++object.prop || --object.prop
        if (parent.type === Syntax.UpdateExpression && parent.operator === '++' || parent.operator === '--')
            return false;
        // Skip: new (object.prop)() || new (object.prop)
        if (parent.type === Syntax.NewExpression && parent.callee === node)
            return false;
        // Skip: for(object.prop in source)
        if (parent.type === Syntax.ForInStatement && parent.left === node)
            return false;
        return true;
    },
    run: node => createPropertyGetWrapper(node.property.name, node.object)
};
