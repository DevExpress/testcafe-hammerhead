// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/*eslint-disable no-unused-vars*/
import { Literal, Identifier, ExpressionStatement, BlockStatement, Expression, CallExpression,
    AssignmentExpression, MemberExpression, SpreadElement, VariableDeclaration, Statement } from 'estree';
/*eslint-enable no-unused-vars*/
import { Syntax } from 'esotope-hammerhead';
import INTERNAL_LITERAL from './internal-literal';
import INSTRUCTION from './instruction';
import { getResourceTypeString } from '../../utils/url';

export function createStringLiteral (value: string): Literal {
    return {
        type:  Syntax.Literal,
        value: value,
        raw:   `"${value}"`
    };
}

export function createTempVarIdentifier (): Identifier {
    return {
        type: Syntax.Identifier,
        name: INTERNAL_LITERAL.tempVar
    };
}

export function createAssignmentExprStmt (left: MemberExpression, right: Identifier): ExpressionStatement {
    return {
        type: Syntax.ExpressionStatement,

        expression: {
            type:     Syntax.AssignmentExpression,
            operator: '=',
            left:     left,
            right:    right
        }
    };
}

export function createBlockExprStmt (children: Array<Statement>): BlockStatement {
    return {
        type: Syntax.BlockStatement,
        body: children
    };
}

export function createVarDeclaration (identifier: Identifier, init?: Expression): VariableDeclaration {
    return {
        type: Syntax.VariableDeclaration,

        declarations: [
            {
                type: Syntax.VariableDeclarator,
                id:   identifier,
                init: init || null
            }
        ],

        kind: 'var'
    };
}

export function createProcessScriptMethCall (arg: Expression | SpreadElement, isApply?: boolean): CallExpression {
    const args: Array<Expression | SpreadElement> = [arg];

    if (isApply) {
        args.push({
            type:  Syntax.Literal,
            value: true,
            raw:   'true'
        });
    }

    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.processScript
        },

        arguments: args
    };
}

export function createLocationGetWrapper (): CallExpression {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getLocation
        },

        arguments: [
            {
                type: Syntax.Identifier,
                name: 'location'
            }
        ]
    };
}

export function createLocationSetWrapper (value: Expression, wrapWithSequence: boolean): Expression {
    const tempIdentifier     = createTempVarIdentifier();
    const locationIdentifier = <Identifier>{
        type: Syntax.Identifier,
        name: 'location'
    };

    let wrapper: Expression = {
        type: Syntax.CallExpression,

        callee: {
            type:     Syntax.MemberExpression,
            computed: false,

            object: {
                type:   Syntax.FunctionExpression,
                id:     null,
                params: [],

                body: {
                    type: Syntax.BlockStatement,
                    body: [
                        createVarDeclaration(tempIdentifier, value),
                        {
                            type: Syntax.ReturnStatement,

                            argument: {
                                type:     Syntax.LogicalExpression,
                                operator: '||',

                                left: {
                                    type: Syntax.CallExpression,

                                    callee: {
                                        type: Syntax.Identifier,
                                        name: INSTRUCTION.setLocation
                                    },

                                    arguments: [locationIdentifier, tempIdentifier]
                                },

                                right: {
                                    type:     Syntax.AssignmentExpression,
                                    operator: '=',
                                    left:     locationIdentifier,
                                    right:    tempIdentifier
                                }
                            }
                        }
                    ]
                },

                generator: false
            },

            property: {
                type: Syntax.Identifier,
                name: 'call'
            }
        },

        arguments: [
            {
                type: Syntax.ThisExpression
            }
        ]
    };

    if (wrapWithSequence) {
        wrapper = {
            type: Syntax.SequenceExpression,

            expressions: [
                {
                    type:  'Literal',
                    value: 0,
                    raw:   '0'
                },
                wrapper
            ]
        };
    }

    return wrapper;
}

export function createPropertySetWrapper (propertyName: string, obj: Expression, value: Expression): CallExpression {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.setProperty
        },

        arguments: [obj, createStringLiteral(propertyName), value]
    };
}

export function createMethCallWrapper (owner: Expression, meth: Literal, args: Array<Expression | SpreadElement>): CallExpression {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.callMethod
        },

        arguments: [owner, meth, {
            type:     Syntax.ArrayExpression,
            elements: args
        }]
    };
}

export function createPropertyGetWrapper (propertyName: string, owner: Expression): CallExpression {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getProperty
        },

        arguments: [owner, createStringLiteral(propertyName)]
    };
}

export function createComputedPropertyGetWrapper (property: Expression, owner: Expression): CallExpression {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getProperty
        },

        arguments: [owner, property]
    };
}

export function createComputedPropertySetWrapper (property: Expression, owner: Expression, value: Expression): CallExpression {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.setProperty
        },

        arguments: [owner, property, value]
    };
}

export function createGetEvalMethCall (node: Expression): CallExpression {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getEval
        },

        arguments: [node]
    };
}

export function getProxyUrlLiteral (source: Literal, resolver: Function): Literal {
    const proxyUrl = resolver(String(source.value), getResourceTypeString({ isScript: true }));

    return {
        type:  Syntax.Literal,
        value: proxyUrl,
        raw:   `"${proxyUrl}"`
    };
}

export function createGetProxyUrlMethCall (arg: Expression | SpreadElement, baseUrl?: string): CallExpression {
    const args = [arg];

    if (baseUrl) {
        args.push({
            type:  Syntax.Literal,
            value: baseUrl,
            raw:   `"${baseUrl}"`
        });
    }

    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getProxyUrl
        },

        arguments: args
    };
}

export function createGetPostMessageMethCall (node: Expression): CallExpression {
    const parentObject = node.type === Syntax.MemberExpression ? node.object as Expression : null;

    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getPostMessage
        },

        arguments: parentObject ? [parentObject] : [
            {
                type:  Syntax.Literal,
                value: null
            },
            node
        ]
    };
}

export function createExpandedConcatOperation (left: Identifier | MemberExpression, right: Expression): AssignmentExpression {
    return {
        type:     Syntax.AssignmentExpression,
        operator: '=',
        left:     left,

        right: {
            type:     Syntax.BinaryExpression,
            operator: '+',
            left:     left,
            right:    right
        }
    };
}

export function createHtmlProcessorWrapper (node: ExpressionStatement): Statement {
    const member = <MemberExpression>{
        type: Syntax.MemberExpression,

        object: {
            type: Syntax.Identifier,
            name: 'parent'
        },

        property: {
            type: Syntax.Identifier,
            name: INSTRUCTION.processHtml
        }
    };

    return {
        type: Syntax.ExpressionStatement,

        expression: {
            type: Syntax.CallExpression,

            callee: member,

            arguments: [
                {
                    type: Syntax.Identifier,
                    name: 'window'
                },
                node.expression
            ]
        }
    };
}
