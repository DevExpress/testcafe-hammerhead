import {
    Expression,
    ObjectPattern,
    Pattern,
    ArrayPattern,
    AssignmentPattern,
    AssignmentProperty,
    Identifier,
    CallExpression,
} from 'estree';
import { Syntax } from 'esotope-hammerhead';
import {
    createArrayExpression,
    createArrayWrapper,
    createBinaryExpression,
    createConditionalExpression,
    createIdentifier,
    createMemberExpression,
    createSimpleCallExpression,
    createSimpleLiteral,
    createUndefined,
} from './node-builder';
import TempVariables from './transformers/temp-variables';
import INSTRUCTION from './instruction';

type NodeBuilder = (pattern: Pattern, value: Expression | null, isTemp?: boolean) => void;

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

function createTempIdentifierOrUseExisting (value: Expression, build: NodeBuilder, baseTempName?: string): Identifier {
    if (value.type === Syntax.Identifier && TempVariables.isHHTempVariable(value.name))
        return value;

    const tempIdentifier = createIdentifier(baseTempName || TempVariables.generateName(baseTempName));

    build(tempIdentifier, value, true);

    return tempIdentifier;
}

function processObjectPattern (pattern: ObjectPattern, value: Expression | null, build: NodeBuilder, baseTempName?: string) {
    if (!value)
        return;

    const properties     = pattern.properties;
    const hasRest        = properties.length && properties[properties.length - 1].type === Syntax.RestElement;
    const tempIdentifier = createTempIdentifierOrUseExisting(value, build, baseTempName);
    const propNames      = [] as Expression[];
    const baseTempNames  = [] as string[];

    if (!baseTempName)
        baseTempName = tempIdentifier.name;

    if (hasRest) {
        for (let i = 0; i < properties.length - 1; i++) {
            const prop = properties[i] as AssignmentProperty;
            const key  = prop.key;

            if (key.type === Syntax.Identifier)
                propNames.push(prop.computed ? key : createSimpleLiteral(key.name));
            else if (key.type === Syntax.Literal)
                propNames.push(key);
            else {
                const tempPropKey = createIdentifier(TempVariables.generateName());

                build(tempPropKey, key, true);
                propNames.push(tempPropKey);

                prop.key = tempPropKey;
            }
        }
    }

    for (let i = 0; i < properties.length; i++) {
        const prop = properties[i];

        if (prop.type === Syntax.RestElement)
            build(prop.argument, createObjectRest(tempIdentifier, propNames));
        else {
            const assignmentProp = prop as AssignmentProperty;
            let newBaseTempName  = TempVariables.generateName(baseTempName, assignmentProp.key, i);

            if (baseTempNames.indexOf(newBaseTempName) > -1)
                newBaseTempName = TempVariables.generateName(newBaseTempName, void 0, i);

            baseTempNames.push(newBaseTempName);

            processObjectProperty(assignmentProp, tempIdentifier, build, newBaseTempName);
        }
    }
}

function processArrayPattern (pattern: ArrayPattern, value: Expression | null, build: NodeBuilder, baseTempName?: string) {
    if (!value)
        return;

    // NOTE: support iterable objects (GH-2669)
    if (value.type !== Syntax.ArrayExpression)
        value = createArrayWrapper(value);

    const tempIdentifier = createTempIdentifierOrUseExisting(value, build, baseTempName);

    if (!baseTempName)
        baseTempName = tempIdentifier.name;

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

        process(elem, value, build, TempVariables.generateName(baseTempName, void 0, i));
    }
}

function processAssignmentPattern (pattern: AssignmentPattern, value: Expression | null, build: NodeBuilder, baseTempName?: string) {
    if (!value)
        return;

    const { left, right } = pattern;
    const tempIdentifier  = createTempIdentifierOrUseExisting(value, build, baseTempName);
    const tempCondition   = createBinaryExpression(tempIdentifier, '===', createUndefined());
    const tempConditional = createConditionalExpression(tempCondition, right, tempIdentifier);

    if (!baseTempName)
        baseTempName = tempIdentifier.name;

    baseTempName += '$assign';

    process(left, tempConditional, build, baseTempName);
}

export default function process (pattern: Pattern, value: Expression | null, build: NodeBuilder, baseTempName?: string) {
    if (pattern.type === Syntax.ObjectPattern)
        processObjectPattern(pattern, value, build, baseTempName);
    else if (pattern.type === Syntax.ArrayPattern)
        processArrayPattern(pattern, value, build, baseTempName);
    else if (pattern.type === Syntax.AssignmentPattern)
        processAssignmentPattern(pattern, value, build, baseTempName);
    else
        build(pattern, value);
}
