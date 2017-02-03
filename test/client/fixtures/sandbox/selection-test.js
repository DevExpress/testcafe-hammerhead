var selectionSandbox = hammerhead.eventSandbox.selection;
var browserUtils     = hammerhead.utils.browser;

var inputTestValue  = 'test@host.net';
var isIE            = browserUtils.isIE;
var isMobileBrowser = browserUtils.isIOS || browserUtils.isAndroid;

var createTestInput = function () {
    var input = $('<input type="email">').appendTo(document.body)[0];

    input.value = inputTestValue;

    return input;
};

test('Set and get selection on input with "email" type', function () {
    var input = createTestInput();

    var testSelection = {
        start:     2,
        end:       9,
        direction: 'backward'
    };

    input.setSelectionRange(testSelection.start, testSelection.end, testSelection.direction);

    var selection = selectionSandbox.getSelection(input);

    equal(selection.start, testSelection.start);
    equal(selection.end, testSelection.end);

    if (!isIE)
        equal(selection.direction, testSelection.direction);

    document.body.removeChild(input);
});

test('Get selection on input with "email" type', function () {
    var input     = createTestInput();
    var selection = selectionSandbox.getSelection(input);

    equal(selection.start, browserUtils.isFirefox && browserUtils.version < 51 || isIE ? 0 : inputTestValue.length);
    equal(selection.end, browserUtils.isFirefox && browserUtils.version < 51 || isIE ? 0 : inputTestValue.length);

    if (isMobileBrowser || browserUtils.isSafari || browserUtils.isChrome && browserUtils.isMacPlatform)
        equal(selection.direction, 'none');
    else if (!isIE)
        equal(selection.direction, 'forward');

    document.body.removeChild(input);
});
