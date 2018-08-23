var positionUtils = hammerhead.utils.position;

var TEST_DIV_SELECTOR   = '#testDiv';

QUnit.testStart(function () {
    if (!$(TEST_DIV_SELECTOR).length)
        $('<div id="testDiv">').appendTo('body');
});

QUnit.testDone(function () {
    $(TEST_DIV_SELECTOR).remove();
});

module('regression');

test('`getOffsetPosition` with `roundFn` arg', function () {
    var testDiv = document.querySelector(TEST_DIV_SELECTOR);
    var parent  = document.createElement('div');
    var child   = document.createElement('div');

    parent.style.width           = '20px';
    parent.style.height          = '20px';
    parent.style.backgroundColor = 'red';
    parent.style.padding         = '0.3px';
    child.style.width            = '10px';
    child.style.height           = '10px';
    child.style.backgroundColor  = 'blue';

    parent.appendChild(child);
    testDiv.appendChild(parent);

    // NOTE: if we have floating value as offsetPosition we need to use Math.ceil instead of Math.round in Firefox
    // otherwise the method `elementFromPoint` will not return correct element

    var offsetPositionCeil  = positionUtils.getOffsetPosition(child, Math.ceil);
    var offsetPositionRound = positionUtils.getOffsetPosition(child, Math.round);
    var elementInPoint      = document.elementFromPoint(offsetPositionCeil.left, offsetPositionCeil.top);

    notDeepEqual(offsetPositionCeil, offsetPositionRound);
    strictEqual(elementInPoint, child);
});
