import { Syntax } from './parsing-tools';
import * as templates from './templates';
import * as instructs from './instructions';

function updateAstNode (node, newNode, parent, key) {
    /*eslint-disable indent*/
    if (key === 'arguments' || key === 'elements' || key === 'expressions') {
        var index = parent[key].indexOf(node);

        parent[key][index] = newNode;
    }
    else
        parent[key] = newNode;
    /*eslint-enable indent*/
}

// for(obj[i++] in src), for(obj['href'] in src), for(obj.href in src)
function forin (astNode) {
    // for(obj[i++] in src) --> for(__set$temp in src) { __set$(obj, i++, __set$temp); }
    var tempVarAst = {
        type: Syntax.Identifier,
        name: instructs.FOR_IN_TEMP_VAR_NAME
    };

    astNode.body.body.unshift({
        type: Syntax.ExpressionStatement,

        expression: {
            type:     Syntax.AssignmentExpression,
            operator: '=',
            left:     astNode.left,
            right:    tempVarAst
        }
    });

    astNode.left = {
        type: Syntax.VariableDeclaration,

        declarations: [
            {
                type: Syntax.VariableDeclarator,
                id:   tempVarAst,
                init: null
            }
        ],

        kind: 'var'
    };

    return true;
}

// new Function([, params], [body]);
function functionCtor (astNode) {
    if (!astNode.arguments.length)
        return false;

    var lastArgIndex = astNode.arguments.length - 1;

    // new Function([, params], [body]); --> new Function([, params], __proc$Script([body]));
    astNode.arguments[lastArgIndex] = templates.getProcessScriptMethAst([astNode.arguments[lastArgIndex]]);

    return false;
}

// { ... [obj].write([html]); ... [obj].writeln([html]); ... }
function documentWrite (astNode) {
    var indices = templates.getDocumentWriteStatementIndices(astNode.body);

    // { ... [obj].write([html]); ... [obj].writeln([html]); ... } -->
    // { ... [obj].write([html], __begin$); ... [obj].writeln([html], __end$); ... }
    astNode.body[indices[0]].expression.arguments.push(templates.getDocumentWriteArgAst(instructs.DOCUMENT_WRITE_BEGIN_PARAM));
    astNode.body[indices[indices.length -
                         1]].expression.arguments.push(templates.getDocumentWriteArgAst(instructs.DOCUMENT_WRITE_END_PARAM));

    return false;
}

// eval(), window.eval(), window['eval']
function evalArgument (astNode) {
    if (!astNode.arguments.length)
        return false;

    // eval(script) --> eval(__proc$Script(script))
    var newArg = templates.getProcessScriptMethAst(astNode.arguments);

    astNode.arguments[0] = newArg;

    return false;
}

// eval.call(), window.eval.call(), window['eval'].call()
function callEvalArgument (astNode) {
    // eval.call(window, script) --> eval.call(window, __proc$Script(script))
    var newArg = templates.getProcessScriptMethAst([astNode.arguments[1]]);

    astNode.arguments[1] = newArg;

    return false;
}

// eval.apply(), window.eval.apply(), window['eval'].apply()
function applyEvalArgument (astNode) {
    // eval.apply(window, [script]) --> eval.apply(window, [__proc$Script(script)])
    var newArg = templates.getProcessScriptMethAst([astNode.arguments[1].elements[0]]);

    astNode.arguments[1].elements[0] = newArg;

    return false;
}

// location
function getLocation (astNode, parent, key) {
    // location --> __get$Loc(location)
    var newNode = templates.getGetLocationMethAst();

    updateAstNode(astNode, newNode, parent, key);

    return false;
}

// location.[field]
function getLocationMember (astNode) {
    // location.[field]  --> __get$Loc(location).[field]
    // location[[field]] --> __get$(__get$Loc(location), [field])
    var newNode = templates.getGetLocationMethAst(astNode.object);

    astNode.object = newNode;

    return false;
}

// location = [value]
function setLocation (astNode, parent, key) {
    // location = [value] --> (function(){ return __set$Loc(location, [value]) || location = [value];}.apply(this))
    var newNode = templates.getSetLocationMethAst(astNode.right);

    updateAstNode(astNode, newNode, parent, key);

    return false;
}

// [object].location = [value]
function memberSet (astNode, parent, key) {
    // [any].location = [value] --> __set$([object], 'location', [value])
    var newNode = templates.getSetMethAst(astNode.left.property.name, astNode.left.object, astNode.right);

    updateAstNode(astNode, newNode, parent, key);

    return true;
}

// [object].location
function memberGet (astNode, parent, key) {
    // [object].location --> __get$([object], 'location')
    var newNode = templates.getGetMethAst(astNode.property.name, astNode.object);

    updateAstNode(astNode, newNode, parent, key);

    return true;
}

// [object].[method]() || [object][[method]]()
function callMethod (astNode, parent, key) {
    var meth = null;

    /*eslint-disable indent*/
    if (!astNode.callee.computed) {
        meth = {
            type:  Syntax.Literal,
            value: astNode.callee.property.name,
            raw:   '"' + astNode.callee.property.name + '"'
        };
    }
    else
        meth = astNode.callee.property;
    /*eslint-enable indent*/

    // [object].[method]([args]) --> _call$([object], [method], [args])
    // [object][[method]]([args]) --> _call$([object], [method], [args])
    var newNode = templates.getCallMethodMthAst(astNode.callee.object, meth, astNode.arguments);

    updateAstNode(astNode, newNode, parent, key);

    return true;
}

// [object][[field]]
function computedMemberGet (astNode, parent, key) {
    //[object][[field]] --> __get$([object], [field])
    var newNode = templates.getGetComputedMethAst(astNode.property, astNode.object);

    updateAstNode(astNode, newNode, parent, key);

    return true;
}

// [object][[field]] = [value]
function computedMemberSet (astNode, parent, key) {
    //[object][[field]] = [value] --> __set$([object], [field], [value])
    var newNode = templates.getSetComputedMethAst(astNode.left.property, astNode.left.object, astNode.right);

    updateAstNode(astNode, newNode, parent, key);

    return true;
}

// [object] += [value]
function concatOperator (astNode, parent, key) {
    //[object] += [value] --> [object] = [object] + [value]
    var newNode = templates.getConcatOperatorAst(astNode.left, astNode.right);

    updateAstNode(astNode, newNode, parent, key);

    return true;
}

// Modify conditions
export default [
    {
        modifier:  documentWrite,
        condition: function (astNode) {
            // { ... [obj].write([html]); ... [obj].writeln([html]); ... }
            if (astNode.type === Syntax.BlockStatement || astNode.type === Syntax.Program)
                return templates.getDocumentWriteStatementIndices(astNode.body).length > 1;

            return false;
        }
    },
    {
        modifier:  functionCtor,
        condition: function (astNode) {
            // new Function(...)
            if (astNode.type === Syntax.NewExpression && astNode.callee.name === 'Function')
                return true;

            return false;
        }
    },
    {
        modifier:  forin,
        condition: function (astNode) {
            // for(var key in obj)
            if (astNode.type === Syntax.ForInStatement) {
                // for (obj[prop] in src), for (obj['prop'] in src), for (obj.href in src)
                if (astNode.left.type === Syntax.MemberExpression)
                    return true;
            }

            return false;
        }
    },
    {
        modifier:  evalArgument,
        condition: function (astNode) {
            if (astNode.type === Syntax.CallExpression) {
                // eval([...]), setTimeout([...]), setInterval([...])
                if (astNode.callee.type === Syntax.Identifier &&
                    /^(eval|setTimeout|setInterval)$/.test(astNode.callee.name))
                    return true;

                // [obj].eval([...]), [obj]['eval']([...]), [obj].setTimeout([...]), [obj]['setTimeout']([...]), [obj].setInterval([...]), [obj]['setInterval']([...])
                if (astNode.callee.type === Syntax.MemberExpression &&
                    /^(eval|setTimeout|setInterval)$/.test(astNode.callee.property.name ||
                                                           astNode.callee.property.value))
                    return true;
            }

            return false;
        }
    },
    {
        modifier:  callEvalArgument,
        condition: function (astNode) {
            if (astNode.type === Syntax.CallExpression) {
                // [obj].eval.call([...]), [obj][eval].call([...]), [obj].setTimeout.call([...]), [obj][setTimeout].call([...]),
                // [obj].setInterval.call([...]), [obj][setInterval].call([...])
                if (astNode.callee.type === Syntax.MemberExpression && astNode.callee.property.name === 'call') {
                    var obj = astNode.callee.object;

                    if (obj.type === Syntax.MemberExpression &&
                        /^(eval|setTimeout|setInterval)$/.test(obj.property.value || obj.property.name))
                        return true;
                }

                // eval.call([...]), setTimeout.call([...]), setInterval.call([...])
                if (astNode.callee.type === Syntax.MemberExpression && astNode.callee.property.name === 'call' &&
                    /^(eval|setTimeout|setInterval)$/.test(astNode.callee.object.name))
                    return true;
            }

            return false;
        }
    },
    {
        modifier:  applyEvalArgument,
        condition: function (astNode) {
            if (astNode.type === Syntax.CallExpression) {
                // [obj].eval.apply([...]), [obj][eval].apply([...]), [obj].setTimeout.apply([...]), [obj][setTimeout].apply([...]),
                // [obj].setInterval.apply([...]), [obj][setInterval].apply([...])
                if (astNode.callee.type === Syntax.MemberExpression && astNode.callee.property.name === 'apply') {
                    var obj = astNode.callee.object;

                    if (obj.type === Syntax.MemberExpression &&
                        /^(eval|setTimeout|setInterval)$/.test(obj.property.value || obj.property.name))
                        return true;
                }

                // eval.apply([...]), setTimeout.apply([...]), setInterval.apply([...])
                if (astNode.callee.type === Syntax.MemberExpression && astNode.callee.property.name === 'apply' &&
                    /^(eval|setTimeout|setInterval)$/.test(astNode.callee.object.name))
                    return true;
            }

            return false;
        }
    },
    {
        modifier:  getLocation,
        condition: function (astNode, parent) {
            if (astNode.type === Syntax.Identifier) {
                if (astNode.name !== 'location')
                    return false;

                // var location = [value];
                if (parent.type === Syntax.VariableDeclarator && parent.id === astNode)
                    return false;

                // location = [value]
                if (parent.type === Syntax.AssignmentExpression && parent.left === astNode)
                    return false;

                // [object].location || location.[field]
                if (parent.type === Syntax.MemberExpression)
                    return false;

                // { location: [value] }
                if (parent.type === Syntax.Property && parent.key === astNode)
                    return false;

                // location++ || location-- || ++location || --location
                if (parent.type === Syntax.UpdateExpression && parent.operator === '++' || parent.operator === '--')
                    return false;

                // function (location) { ... } || function func(location) { ... }
                if ((parent.type === Syntax.FunctionExpression ||
                     parent.type === Syntax.FunctionDeclaration) && parent.params.indexOf(astNode) !== -1)
                    return false;

                // Already  modified: __getGlobalProperty('location', location)
                if (parent.type === Syntax.CallExpression &&
                    parent.callee.name === instructs.GET_LOCATION_METH_NAME)
                    return false;

                return true;
            }

            return false;
        }
    },
    {
        modifier:  getLocationMember,
        condition: function (astNode, parent) {
            // [object].[field]
            if (astNode.type === Syntax.MemberExpression) {
                // for(location.[field] in [source])
                if (parent.type === Syntax.ForInStatement && parent.left === astNode)
                    return false;

                // location.[field]
                if (astNode.object.name === 'location')
                    return true;
            }

            return false;
        }
    },
    {
        modifier:  setLocation,
        condition: function (astNode) {
            // [object] = [value]
            if (astNode.type === Syntax.AssignmentExpression && astNode.operator === '=') {
                var leftOperand = astNode.left;

                // location = [value]
                if (leftOperand.type === Syntax.Identifier && leftOperand.name === 'location')
                    return true;
            }

            return false;
        }
    },
    {
        modifier:  memberSet,
        condition: function (astNode) {
            // [object] = [value]
            if (astNode.type === Syntax.AssignmentExpression && !astNode.computed && astNode.operator === '=') {
                var leftOperand = astNode.left;

                // [object].[field] = []
                if (leftOperand.type === Syntax.MemberExpression &&
                    leftOperand.property.type === Syntax.Identifier) {
                    // [object].location = [value]
                    if (instructs.needToWrapProperty(leftOperand.property.name))
                        return true;
                }
            }

            return false;
        }
    },
    {
        modifier:  callMethod,
        condition: function (astNode) {
            // [object]()
            if (astNode.type === Syntax.CallExpression) {
                // [object].[field]() || [object][[field]]()
                if (astNode.callee.type === Syntax.MemberExpression) {
                    if (astNode.callee.computed && astNode.callee.property.type === Syntax.Literal &&
                        !instructs.needToWrapMethod(astNode.callee.property.value))
                        return false;

                    if (!astNode.callee.computed && !instructs.needToWrapMethod(astNode.callee.property.name))
                        return false;

                    return true;
                }
            }

            return false;
        }
    },
    {
        modifier:  memberGet,
        condition: function (astNode, parent) {
            // [object].[field]
            if (astNode.type === Syntax.MemberExpression && !astNode.computed) {
                if (!instructs.needToWrapProperty(astNode.property.name))
                    return false;

                // [object].[field] = [value]
                if (parent.type === Syntax.AssignmentExpression && parent.left === astNode)
                    return false;

                // delete [object].[field]
                if (parent.type === Syntax.UnaryExpression && parent.operator === 'delete')
                    return false;

                // [object].[field]()
                if (parent.type === Syntax.CallExpression && parent.callee === astNode)
                    return false;

                // [object].[field]++ || [object].[field]-- || ++[object].[field] || --[object].[field]
                if (parent.type === Syntax.UpdateExpression && parent.operator === '++' || parent.operator === '--')
                    return false;

                // new ([object].[field])() || new ([object].[field])
                if (parent.type === Syntax.NewExpression && parent.callee === astNode)
                    return false;

                // for([object].[field] in [source])
                if (parent.type === Syntax.ForInStatement && parent.left === astNode)
                    return false;

                return true;
            }

            return false;
        }
    },
    {
        modifier:  computedMemberGet,
        condition: function (astNode, parent) {
            // [object][[field]]
            if (astNode.type === Syntax.MemberExpression && astNode.computed) {

                // [object][[field]] = [value]
                if (parent.type === Syntax.AssignmentExpression && parent.left === astNode)
                    return false;

                // delete [object][[field]]
                if (parent.type === Syntax.UnaryExpression && parent.operator === 'delete')
                    return false;

                // [object].[field]++ || [object].[field]-- || ++[object].[field] || --[object].[field]
                if (parent.type === Syntax.UpdateExpression && parent.operator === '++' || parent.operator === '--')
                    return false;

                // [object][[field]]()
                if (parent.type === Syntax.CallExpression && parent.callee === astNode)
                    return false;

                // new ([object][[field]])() || new ([object][[field]])
                if (parent.type === Syntax.NewExpression && parent.callee === astNode)
                    return false;

                // for([object].[[field]] in [source])
                if (parent.type === Syntax.ForInStatement && parent.left === astNode)
                    return false;

                if (astNode.property.type === Syntax.Literal && !instructs.needToWrapProperty(astNode.property.value))
                    return false;

                return true;
            }

            return false;
        }
    },
    {
        modifier:  computedMemberSet,
        condition: function (astNode) {
            // [object] = [value]
            if (astNode.type === Syntax.AssignmentExpression && astNode.operator === '=') {
                // [object][[field]] = [value]
                if (astNode.left.type === Syntax.MemberExpression && astNode.left.computed) {
                    // [object].location = [value]
                    if (astNode.left.property.type === Syntax.Literal)
                        return instructs.needToWrapProperty(astNode.left.property.value);

                    return true;
                }
            }

            return false;
        }
    },
    {
        modifier:  concatOperator,
        condition: function (astNode) {
            // [object] += [value]
            if (astNode.type === Syntax.AssignmentExpression && astNode.operator === '+=')
                return true;

            return false;
        }
    }
];
