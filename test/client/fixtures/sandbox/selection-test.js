var selectionSandbox = hammerhead.eventSandbox.selection;
var browserUtils     = hammerhead.utils.browser;

var inputTestValue  = 'test@host.net';
var isIE            = browserUtils.isIE;
var isMobileBrowser = browserUtils.isIOS || browserUtils.isAndroid;

var createTestInput = function () {
    document.body.innerHTML = '<input type="email">';

    var input = document.querySelector('input');

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

    strictEqual(selection.start, testSelection.start);
    strictEqual(selection.end, testSelection.end);

    if (!isIE)
        strictEqual(selection.direction, testSelection.direction);

    document.body.removeChild(input);
});

test('Get selection on input with "email" type', function () {
    var input     = createTestInput();
    var selection = selectionSandbox.getSelection(input);

    strictEqual(selection.start, browserUtils.isFirefox && browserUtils.version < 51 || isIE ? 0 : inputTestValue.length);
    strictEqual(selection.end, browserUtils.isFirefox && browserUtils.version < 51 || isIE ? 0 : inputTestValue.length);

    if (isMobileBrowser || browserUtils.isSafari || browserUtils.isChrome && browserUtils.isMacPlatform)
        strictEqual(selection.direction, 'none');
    else if (!isIE)
        strictEqual(selection.direction, 'forward');

    document.body.removeChild(input);
});
