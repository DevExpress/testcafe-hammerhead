// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { Syntax } from './tools/esotope';

export const USE_STRICT_DIRECTIVE = 'use strict';

export function hasStrictDirective (ast) {
    if (ast.body.length) {
        var firstChild = ast.body[0];

        if (firstChild.type === Syntax.ExpressionStatement && firstChild.expression.type === Syntax.Literal)
            return firstChild.expression.value === USE_STRICT_DIRECTIVE;
    }

    return false;
}
