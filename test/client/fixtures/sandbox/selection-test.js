var selectionSandbox = hammerhead.eventSandbox.selection;
var browserUtils     = hammerhead.utils.browser;

var inputTestValue = 'test@host.net';
var isIE           = browserUtils.isIE;

test('Set and get selection on input with "email" type', function () {
    var input = document.createElement('input');

    input.type  = 'email';
    input.value = inputTestValue;

    document.body.appendChild(input);

    input.setSelectionRange(0, inputTestValue.length, 'backward');

    var selection = selectionSandbox.getSelection(input);

    equal(selection.start, 0);
    equal(selection.end, input.value.length);

    if (!isIE)
        equal(selection.direction, 'backward');

    document.body.removeChild(input);
});
