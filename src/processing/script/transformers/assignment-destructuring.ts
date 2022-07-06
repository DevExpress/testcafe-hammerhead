// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { AssignmentExpression, Identifier } from 'estree';
import { Transformer } from './index';
import { createAssignmentExpression, createSequenceExpression } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import destructuring from '../destructuring';

// Transform:
// ({ location: loc } = window);
// [{ location }, item] = [window, 6]
// -->
// var _hh$temp0, _hh$temp1, _hh$temp1$0;
//
// (_hh$temp0 = window, loc = _hh$temp0.location, _hh$temp0);
// (_hh$temp1 = [window, 6], _hh$temp1$0 = _hh$temp1[0], location = _hh$temp1$0.location, item = _hh$temp1[1], _hh$temp1);

const transformer: Transformer<AssignmentExpression> = {
    name: 'assignment-destructuring',

    nodeReplacementRequireTransform: true,

    nodeTypes: Syntax.AssignmentExpression,

    condition: node => node.operator === '=' && (node.left.type === Syntax.ObjectPattern || node.left.type === Syntax.ArrayPattern),

    run: (node, _parent, _key, tempVars) => {
        const assignments = [] as (AssignmentExpression | Identifier)[];
        let isFirstTemp   = true;
        let firstTemp     = null as Identifier | null;

        destructuring(node.left, node.right, (pattern, value, isTemp) => {

            if (isFirstTemp) {
                isFirstTemp = false;

                if (isTemp)
                    firstTemp = pattern as Identifier;
            }

            assignments.push(createAssignmentExpression(pattern, '=', value));

            if (isTemp && tempVars)
                tempVars.append((pattern as Identifier).name);
        });

        if (firstTemp)
            assignments.push(firstTemp);

        return createSequenceExpression(assignments);
    },
};

export default transformer;
