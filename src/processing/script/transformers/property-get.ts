// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { CallExpression, MemberExpression, Expression, ForInStatement, Identifier } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createPropertyGetWrapper } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import { shouldInstrumentProperty } from '../instrumented';

// Transform:
// obj.<wrappable-property> -->
// __get$(obj, '<wrappable-property>')

const transformer: Transformer = {
    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.MemberExpression,

    condition: (node: MemberExpression, parent: Expression | ForInStatement) => {
        if (node.computed)
            return false;

        if (node.property.type === Syntax.Identifier && !shouldInstrumentProperty(node.property.name))
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
        if (parent.type === Syntax.UpdateExpression && (parent.operator === '++' || parent.operator === '--'))
            return false;

        // Skip: new (object.prop)() || new (object.prop)
        if (parent.type === Syntax.NewExpression && parent.callee === node)
            return false;

        // Skip: for(object.prop in source)
        if (parent.type === Syntax.ForInStatement && parent.left === node)
            return false;

        return true;
    },

    // eslint-disable-next-line
    run: (node: MemberExpression): CallExpression => createPropertyGetWrapper((<Identifier>node.property).name, <Expression>node.object)
};

export default transformer;
