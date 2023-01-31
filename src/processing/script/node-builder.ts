// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import {
    Literal,
    Identifier,
    ExpressionStatement,
    BlockStatement,
    Expression,
    CallExpression,
    AssignmentExpression,
    MemberExpression,
    SpreadElement,
    VariableDeclaration,
    Statement,
    Pattern,
    AssignmentOperator,
    VariableDeclarator,
    SimpleLiteral,
    SimpleCallExpression,
    Super,
    ArrayExpression,
    BinaryExpression,
    BinaryOperator,
    SequenceExpression,
    ThisExpression,
    LogicalExpression,
    LogicalOperator,
    ReturnStatement,
    FunctionExpression,
    ConditionalExpression,
    UnaryOperator,
    UnaryExpression,
} from 'estree';
import { Syntax } from 'esotope-hammerhead';
import INSTRUCTION from './instruction';
import { getResourceTypeString } from '../../utils/url';
import TempVariables from './transformers/temp-variables';

export function createIdentifier (name: string): Identifier {
    return { type: Syntax.Identifier, name };
}

export function createExpressionStatement (expression: Expression): ExpressionStatement {
    return { type: Syntax.ExpressionStatement, expression };
}

export function createAssignmentExpression (left: Pattern | MemberExpression, operator: AssignmentOperator, right: Expression | null): AssignmentExpression {
    //@ts-ignore the `right` value can actually be null, but the AssignmentExpression type definition
    // does not allow to the `right` value be null
    return { type: Syntax.AssignmentExpression, operator, left, right };
}

export function createSimpleCallExpression (callee: Expression | Super, args: (Expression | SpreadElement)[]): SimpleCallExpression {
    return { type: Syntax.CallExpression, callee, arguments: args, optional: false };
}

export function createArrayExpression (elements: (Expression | SpreadElement)[]): ArrayExpression {
    return { type: Syntax.ArrayExpression, elements };
}

export function createMemberExpression (object: Expression | Super, property: Expression, computed: boolean): MemberExpression {
    return { type: Syntax.MemberExpression, object, property, computed, optional: false };
}

export function createBinaryExpression (left: Expression, operator: BinaryOperator, right: Expression): BinaryExpression {
    return { type: Syntax.BinaryExpression, left, right, operator };
}

export function createSequenceExpression (expressions: (Expression | Pattern)[]): SequenceExpression {
    //@ts-ignore SequenceExpression can actually
    // TODO: To write to https://github.com/estree/estree that SequenceExpression must include Pattern
    return { type: Syntax.SequenceExpression, expressions };
}

function createThisExpression (): ThisExpression {
    return { type: Syntax.ThisExpression };
}

function createLogicalExpression (left: Expression, operator: LogicalOperator, right: Expression): LogicalExpression {
    return { type: Syntax.LogicalExpression, left, right, operator };
}

export function createReturnStatement (argument: Expression | null = null): ReturnStatement {
    return { type: Syntax.ReturnStatement, argument };
}

function createFunctionExpression (id: Identifier | null, params: Pattern[], body: BlockStatement, async = false, generator = false): FunctionExpression {
    return { type: Syntax.FunctionExpression, id, params, body, async, generator };
}

function createUnaryExpression (operator: UnaryOperator, argument: Expression): UnaryExpression {
    return { type: Syntax.UnaryExpression, operator, prefix: true, argument };
}

export function createUndefined (): UnaryExpression {
    return createUnaryExpression('void', createSimpleLiteral(0));
}

export function createConditionalExpression (test: Expression, consequent: Expression, alternate: Expression): ConditionalExpression {
    return { type: Syntax.ConditionalExpression, test, consequent, alternate };
}

export function createSimpleLiteral (value: string | boolean | number | null): SimpleLiteral {
    return { type: Syntax.Literal, value };
}

export function createAssignmentExprStmt (left: Pattern | MemberExpression, right: Identifier): ExpressionStatement {
    return createExpressionStatement(createAssignmentExpression(left, '=', right));
}

export function createBlockStatement (body: Statement[]): BlockStatement {
    return { type: Syntax.BlockStatement, body };
}

export function createVariableDeclarator (id: Pattern, init: Expression | null = null): VariableDeclarator {
    return { type: Syntax.VariableDeclarator, id, init };
}

export function createVariableDeclaration (kind: 'var' | 'let' | 'const', declarations: VariableDeclarator[]): VariableDeclaration {
    return { type: Syntax.VariableDeclaration, declarations, kind };
}

export function createProcessScriptMethodCall (arg: Expression | SpreadElement, isApply?: boolean): CallExpression {
    const args: (Expression | SpreadElement)[] = [arg];
    const processScriptIdentifier              = createIdentifier(INSTRUCTION.processScript);

    if (isApply)
        args.push(createSimpleLiteral(true));

    return createSimpleCallExpression(processScriptIdentifier, args);
}

export function createLocationGetWrapper (location: Identifier): CallExpression {
    const getLocationIdentifier = createIdentifier(INSTRUCTION.getLocation);

    return createSimpleCallExpression(getLocationIdentifier, [location]);
}

export function createLocationSetWrapper (locationIdentifier: Identifier, value: Expression, wrapWithSequence: boolean): Expression {
    const tempIdentifier            = createIdentifier(TempVariables.generateName());
    const setLocationIdentifier     = createIdentifier(INSTRUCTION.setLocation);
    const setLocationCall           = createSimpleCallExpression(setLocationIdentifier, [locationIdentifier, tempIdentifier]);
    const locationAssignment        = createAssignmentExpression(locationIdentifier, '=', tempIdentifier);
    const callIdentifier            = createIdentifier('call');
    const functionWrapper           = createFunctionExpression(null, [], createBlockStatement([
        createVariableDeclaration('var', [createVariableDeclarator(tempIdentifier, value)]),
        createReturnStatement(createLogicalExpression(setLocationCall, '||', locationAssignment)),
    ]));
    const functionWrapperCallMember = createMemberExpression(functionWrapper, callIdentifier, false);
    const functionWrapperCall       = createSimpleCallExpression(functionWrapperCallMember, [createThisExpression()]);

    if (wrapWithSequence)
        return createSequenceExpression([createSimpleLiteral(0), functionWrapperCall]);

    return functionWrapperCall;
}

export function createPropertySetWrapper (propertyName: string, obj: Expression, value: Expression): CallExpression {
    const setPropertyIdentifier = createIdentifier(INSTRUCTION.setProperty);

    return createSimpleCallExpression(setPropertyIdentifier, [obj, createSimpleLiteral(propertyName), value]);
}

export function createMethodCallWrapper (owner: Expression, method: Literal, methodArgs: (Expression | SpreadElement)[], optional = false): CallExpression {
    const callMethodIdentifier = createIdentifier(INSTRUCTION.callMethod);
    const methodArgsArray      = createArrayExpression(methodArgs);
    const args                 = [owner, method, methodArgsArray];

    if (optional)
        args.push(createSimpleLiteral(optional));

    return createSimpleCallExpression(callMethodIdentifier, args);
}

export function createPropertyGetWrapper (propertyName: string, owner: Expression, optional = false): CallExpression {
    const getPropertyIdentifier = createIdentifier(INSTRUCTION.getProperty);
    const args                  = [owner, createSimpleLiteral(propertyName)];

    if (optional)
        args.push(createSimpleLiteral(optional));

    return createSimpleCallExpression(getPropertyIdentifier, args);
}

export function createComputedPropertyGetWrapper (property: Expression, owner: Expression, optional = false): CallExpression {
    const getPropertyIdentifier = createIdentifier(INSTRUCTION.getProperty);
    const args                  = [owner, property];

    if (optional)
        args.push(createSimpleLiteral(optional));

    return createSimpleCallExpression(getPropertyIdentifier, args);
}

export function createComputedPropertySetWrapper (property: Expression, owner: Expression, value: Expression): CallExpression {
    const setPropertyIdentifier = createIdentifier(INSTRUCTION.setProperty);

    return createSimpleCallExpression(setPropertyIdentifier, [owner, property, value]);
}

export function createGetEvalMethodCall (node: Expression): CallExpression {
    const getEvalIdentifier = createIdentifier(INSTRUCTION.getEval);

    return createSimpleCallExpression(getEvalIdentifier, [node]);
}

export function getProxyUrlLiteral (source: Literal, resolver: Function): SimpleLiteral {
    const proxyUrl = resolver(String(source.value), getResourceTypeString({ isScript: true }));

    return createSimpleLiteral(proxyUrl);
}

export function createGetProxyUrlMethodCall (arg: Expression, baseUrl?: string): CallExpression {
    const getProxyUrlIdentifier                = createIdentifier(INSTRUCTION.getProxyUrl);
    const args: (Expression | SpreadElement)[] = [arg];

    if (baseUrl)
        args.push(createSimpleLiteral(baseUrl));

    return createSimpleCallExpression(getProxyUrlIdentifier, args);
}

export function createGetPostMessageMethodCall (node: Expression): CallExpression {
    const getPostMessageIdentifier             = createIdentifier(INSTRUCTION.getPostMessage);
    const args: (Expression | SpreadElement)[] = node.type === Syntax.MemberExpression
        ? [node.object as Expression]
        : [createSimpleLiteral(null), node];

    return createSimpleCallExpression(getPostMessageIdentifier, args);
}

export function createArrayWrapper (array: any): CallExpression {
    const arrayIdentifier = createIdentifier(INSTRUCTION.arrayFrom);

    return createSimpleCallExpression(arrayIdentifier, [array]);
}

export function createExpandedConcatOperation (left: Identifier | MemberExpression, right: Expression): AssignmentExpression {
    return createAssignmentExpression(left, '=', createBinaryExpression(left, '+', right));
}

export function createHtmlProcessorWrapper (node: ExpressionStatement): ExpressionStatement {
    const processHtmlIdentifier    = createIdentifier(INSTRUCTION.processHtml);
    const parentIdentifier         = createIdentifier('parent');
    const windowIdentifier         = createIdentifier('window');
    const processHtmlThroughParent = createMemberExpression(parentIdentifier, processHtmlIdentifier, false);
    const processHtmlCall          = createSimpleCallExpression(processHtmlThroughParent, [windowIdentifier, node.expression]);

    return createExpressionStatement(processHtmlCall);
}

export function createTempVarsDeclaration (tempVars: string[]): VariableDeclaration {
    const declarations: VariableDeclarator[] = [];

    for (const variable of tempVars)
        declarations.push(createVariableDeclarator(createIdentifier(variable)));

    return createVariableDeclaration('var', declarations);
}
