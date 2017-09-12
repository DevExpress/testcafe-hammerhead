var selectionSandbox = hammerhead.eventSandbox.selection;
var browserUtils     = hammerhead.utils.browser;

var inputTestValue  = 'test@host.net';
var isIE            = browserUtils.isIE;
var isMobileBrowser = browserUtils.isIOS || browserUtils.isAndroid;
var browserVersion  = browserUtils.version;

var createTestInput = function (type, value) {
    var input = document.createElement('input');

    input.setAttribute('type', type);

    document.body.appendChild(input);

    input.value = value;

    return input;
};

test('Set and get selection on input with "email" type', function () {
    var input = createTestInput('email', inputTestValue);

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
    var input     = createTestInput('email', inputTestValue);
    var selection = selectionSandbox.getSelection(input);

    strictEqual(selection.start, browserUtils.isFirefox && browserVersion < 51 || isIE ? 0 : inputTestValue.length);
    strictEqual(selection.end, browserUtils.isFirefox && browserVersion < 51 || isIE ? 0 : inputTestValue.length);

    if (isMobileBrowser || browserUtils.isSafari ||
        browserUtils.isChrome && (browserUtils.isMacPlatform || browserVersion < 54))
        strictEqual(selection.direction, 'none');
    else if (!isIE)
        strictEqual(selection.direction, 'forward');

    document.body.removeChild(input);
});

test('Focus should stay on input with "number" type after setting selection', function () {
    var input = createTestInput('number', 123456789);

    var testSelection = {
        start:     2,
        end:       5,
        direction: 'backward'
    };

    input.focus();
    input.setSelectionRange(testSelection.start, testSelection.end, testSelection.direction);

    var selection = selectionSandbox.getSelection(input);

    strictEqual(selection.start, testSelection.start);
    strictEqual(selection.end, testSelection.end);

    if (!isIE)
        strictEqual(selection.direction, testSelection.direction);

    strictEqual(document.activeElement, input);
    document.body.removeChild(input);
});
