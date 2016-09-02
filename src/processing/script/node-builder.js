// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { Syntax } from './tools/esotope';
import INTERNAL_LITERAL from './internal-literal';
import INSTRUCTION from './instruction';

export function createStringLiteral (value) {
    return {
        type:  Syntax.Literal,
        value: value,
        raw:   `"${value}"`
    };
}

export function createTempVarIdentifier () {
    return {
        type: Syntax.Identifier,
        name: INTERNAL_LITERAL.tempVar
    };
}

export function createAssignmentExprStmt (left, right) {
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

export function createVarDeclaration (identifier) {
    return {
        type: Syntax.VariableDeclaration,

        declarations: [
            {
                type: Syntax.VariableDeclarator,
                id:   identifier,
                init: null
            }
        ],

        kind: 'var'
    };
}

export function createProcessScriptMethCall (arg, isApply) {
    var ast = {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.processScript
        },

        arguments: [arg]
    };

    if (isApply) {
        ast.arguments.push({
            type:  Syntax.Literal,
            value: true,
            raw:   'true'
        });
    }

    return ast;
}

export function createGetStorageMethCall (storage) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getStorage
        },

        arguments: [
            {
                type: Syntax.Identifier,
                name: storage
            }
        ]
    };
}

export function createLocationGetWrapper () {
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

export function createLocationSetWrapper (value) {
    return {
        type: Syntax.ExpressionStatement,

        expression: {
            type: Syntax.CallExpression,

            callee: {
                type:     Syntax.MemberExpression,
                computed: false,

                object: {
                    type:     Syntax.FunctionExpression,
                    id:       null,
                    params:   [],
                    defaults: [],

                    body: {
                        type: Syntax.BlockStatement,
                        body: [
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

                                        arguments: [
                                            {
                                                type: Syntax.Identifier,
                                                name: 'location'
                                            },
                                            value
                                        ]
                                    },

                                    right: {
                                        type:     Syntax.AssignmentExpression,
                                        operator: '=',

                                        left: {
                                            type: Syntax.Identifier,
                                            name: 'location'
                                        },

                                        right: value
                                    }
                                }
                            }
                        ]
                    },

                    rest:       null,
                    generator:  false,
                    expression: false
                },

                property: {
                    type: Syntax.Identifier,
                    name: 'apply'
                }
            },

            arguments: [
                {
                    type: Syntax.ThisExpression
                }
            ]
        }
    };
}

export function createPropertySetWrapper (propertyName, obj, value) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.setProperty
        },

        arguments: [
            obj,
            createStringLiteral(propertyName),
            value
        ]
    };
}

export function createMethCallWrapper (owner, meth, args) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.callMethod
        },

        arguments: [
            owner,
            meth,
            {
                type:     Syntax.ArrayExpression,
                elements: args
            }
        ]
    };
}

export function createPropertyGetWrapper (propertyName, owner) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getProperty
        },

        arguments: [
            owner,
            createStringLiteral(propertyName)
        ]
    };
}

export function createComputedPropertyGetWrapper (property, owner) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getProperty
        },

        arguments: [
            owner,
            property
        ]
    };
}

export function createComputedPropertySetWrapper (property, owner, value) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.setProperty
        },

        arguments: [
            owner,
            property,
            value
        ]
    };
}

export function createGetEvalMethCall (node) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: INSTRUCTION.getEval
        },

        arguments: [
            node
        ]
    };
}

export function createGetPostMessageMethCall (node) {
    var parentObject = node.object;

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

export function createExpandedConcatOperation (left, right) {
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
