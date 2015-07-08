import { Syntax } from './parsing-tools';
import * as instructs from './instructions';

export function getProcessScriptMethAst (args) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: instructs.PROCESS_SCRIPT_METH_NAME
        },

        arguments: [
            args[0]
        ]
    };
}

export function getGetLocationMethAst () {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: instructs.GET_LOCATION_METH_NAME
        },

        arguments: [
            {
                type: Syntax.Identifier,
                name: 'location'
            }
        ]
    };
}

export function getSetLocationMethAst (value) {
    return {
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
                                        name: instructs.SET_LOCATION_METH_NAME
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
    };
}

export function getSetMethAst (propertyName, obj, value) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: instructs.SET_PROPERTY_METH_NAME
        },

        arguments: [
            obj, {
                type:  Syntax.Literal,
                value: propertyName,
                raw:   '"' + propertyName + '"'
            },
            value
        ]
    };
}

export function getCallMethodMthAst (owner, meth, args) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: instructs.CALL_METHOD_METH_NAME
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

export function getGetMethAst (propertyName, owner) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: instructs.GET_PROPERTY_METH_NAME
        },

        arguments: [
            owner, {
                type:  Syntax.Literal,
                value: propertyName,
                raw:   '"' + propertyName + '"'
            }
        ]
    };
}

export function getGetComputedMethAst (property, owner) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: instructs.GET_PROPERTY_METH_NAME
        },

        arguments: [
            owner,
            property
        ]
    };
}

export function getSetComputedMethAst (property, owner, value) {
    return {
        type: Syntax.CallExpression,

        callee: {
            type: Syntax.Identifier,
            name: instructs.SET_PROPERTY_METH_NAME
        },

        arguments: [
            owner,
            property,
            value
        ]
    };
}

export function getConcatOperatorAst (left, right) {
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

export function getDocumentWriteArgAst (arg) {
    return {
        type:  Syntax.Literal,
        value: arg,
        raw:   '\'' + arg + '\''
    };
}

export function getDocumentWriteStatementIndices (statements) {
    var indices = [];

    var isExpressionStatement = (statement) => statement.type === Syntax.ExpressionStatement;
    var isCallStatement       = (statement) => statement.expression.type === Syntax.CallExpression;
    var isMember              = (statement) => statement.expression.callee.type === Syntax.MemberExpression;
    var isDocumentWrite       = (statement) => statement.expression.callee.property.name === 'write' ||
                                               statement.expression.callee.property.name === 'writeln';

    for (var i = 0; i < statements.length; i++) {
        var statement = statements[i];

        if (isExpressionStatement(statement) && isCallStatement(statement) && isMember(statement) &&
            isDocumentWrite(statement)) {
            indices.push(i);
        }
    }

    return indices;
}
