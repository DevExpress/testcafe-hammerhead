import {
    Expression,
    ObjectPattern,
    Pattern,
    ArrayPattern,
    AssignmentPattern,
    AssignmentProperty,
    Identifier,
    CallExpression
} from 'estree';
import { Syntax } from 'esotope-hammerhead';
import {
    createArrayExpression,
    createBinaryExpression,
    createConditionalExpression,
    createIdentifier,
    createMemberExpression,
    createSimpleCallExpression,
    createSimpleLiteral,
    createUndefined
} from './node-builder';
import TempVariables from './transformers/temp-variables';
import INSTRUCTION from './instruction';

type NodeBuilder = (pattern: Pattern, value: Expression, isTemp?: boolean) => void;

function processObjectProperty (prop: AssignmentProperty, temp: Identifier, build: NodeBuilder, baseTempName: string) {
    const pattern  = prop.value;
    const computed = prop.computed || prop.key.type === Syntax.Literal;
    const value    = createMemberExpression(temp, prop.key, computed);

    process(pattern, value, build, baseTempName);
}

function createObjectRest (tempIdentifier: Identifier, keys: Expression[]) {
    const restObjectIdentifier = createIdentifier(INSTRUCTION.restObject);

    return createSimpleCallExpression(restObjectIdentifier, [tempIdentifier, createArrayExpression(keys)]);
}

function createRestArray (array: Identifier, startIndex: number): CallExpression {
    const restArrayIdentifier = createIdentifier(INSTRUCTION.restArray);

    return createSimpleCallExpression(restArrayIdentifier, [array, createSimpleLiteral(startIndex)]);
}

function processObjectPattern (pattern: ObjectPattern, value: Expression, build: NodeBuilder, baseTempName: string) {
    if (!baseTempName)
        baseTempName = TempVariables.generate(baseTempName);

    const properties     = pattern.properties;
    // @ts-ignore
    const hasRest        = properties[properties.length - 1].type === Syntax.RestElement;
    const tempIdentifier = createIdentifier(baseTempName);
    const propNames      = [] as Expression[];

    build(tempIdentifier, value, true);

    if (hasRest) {
        for (let i = 0; i < properties.length - 1; i++) {
            const prop = properties[i];
            const key  = prop.key;

            if (key.type === Syntax.Identifier)
                propNames.push(prop.computed ? key : createSimpleLiteral(key.name));
            else if (key.type === Syntax.Literal)
                propNames.push(key);
            else {
                const tempPropKey = createIdentifier(TempVariables.generate());

                build(tempPropKey, key, true);
                propNames.push(tempPropKey);

                prop.key = tempPropKey;
            }
        }
    }

    for (let i = 0; i < properties.length; i++) {
        const prop = properties[i];

        // @ts-ignore
        if (prop.type === Syntax.RestElement) {
            // @ts-ignore
            build(prop.argument, createObjectRest(tempIdentifier, propNames));
        }
        else
            processObjectProperty(prop, tempIdentifier, build, TempVariables.generate(baseTempName, prop.key, i));
    }
}

function processArrayPattern (pattern: ArrayPattern, value: Expression, build: NodeBuilder, baseTempName?: string) {
    if (!baseTempName)
        baseTempName = TempVariables.generate(baseTempName);

    const tempIdentifier = createIdentifier(baseTempName);

    build(tempIdentifier, value, true);

    for (let i = 0; i < pattern.elements.length; i++) {
        let elem = pattern.elements[i];

        if (!elem)
            continue;

        if (elem.type === Syntax.RestElement) {
            value = createRestArray(tempIdentifier, i);
            elem  = elem.argument;
        }
        else
            value = createMemberExpression(tempIdentifier, createSimpleLiteral(i), true);

        process(elem, value, build, TempVariables.generate(baseTempName, null, i));
    }
}

function processAssignmentPattern (pattern: AssignmentPattern, value: Expression, build: NodeBuilder, baseTempName?: string) {
    if (!baseTempName)
        baseTempName = TempVariables.generate(baseTempName);

    const { left, right } = pattern;
    let tempIdentifier    = createIdentifier(baseTempName);

    build(tempIdentifier, value, true);

    const tempCondition   = createBinaryExpression(tempIdentifier, '===', createUndefined());
    const tempConditional = createConditionalExpression(tempCondition, right, tempIdentifier);

    baseTempName += '$' + 'assign';

    process(left, tempConditional, build, baseTempName);
}

export default function process(pattern: Pattern, value: Expression, build: NodeBuilder, baseTempName?: string) {
    if (pattern.type === Syntax.ObjectPattern)
        processObjectPattern(pattern, value, build, baseTempName);
    else if (pattern.type === Syntax.ArrayPattern)
        processArrayPattern(pattern, value, build, baseTempName);
    else if (pattern.type === Syntax.AssignmentPattern)
        processAssignmentPattern(pattern, value, build, baseTempName);
    else
        build(pattern, value);
}
