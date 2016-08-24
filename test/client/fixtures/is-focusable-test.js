var domUtils      = hammerhead.utils.dom;
var browserUtils  = hammerhead.utils.browser;
var iframeSandbox = hammerhead.sandbox.iframe;


var TEST_ELEMENT_CLASS      = 'testElement';
var focusedElements         = [];
var expectedFocusedElements = [];
var iframe                  = null;

var createElements = function () {
    var body = document.body;

    expectedFocusedElements.push($('<input type="text">').attr('value', 'text input').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0]);
    expectedFocusedElements.push($('<textarea>').css('height', 100).attr('value', 'textarea').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0]);
    expectedFocusedElements.push($('<a>').attr('href', 'http://www.example.org/').attr('tabIndex', 2).text('Link with href').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0]);
    expectedFocusedElements.push($('<div></div>').text('div tag with tabIndex').attr('tabIndex', 1).addClass(TEST_ELEMENT_CLASS).appendTo(body)[0]);

    var divContentEditable = $('<div></div>').text('content editable div').attr('contenteditable', '').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0];

    expectedFocusedElements.push(divContentEditable);
    expectedFocusedElements.push($('<button>button</button>').attr('tabIndex', '4').addClass(TEST_ELEMENT_CLASS).appendTo(divContentEditable)[0]);
    expectedFocusedElements.push($('<div></div>').text('content editable div 2').attr('contenteditable', 'true').attr('tabIndex', '4').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0]);

    $('<p>paragraph</p>').addClass(TEST_ELEMENT_CLASS).appendTo(divContentEditable);

    expectedFocusedElements.push($('<input type="submit">').attr('value', 'submit input').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0]);
    expectedFocusedElements.push($('<input type="checkbox">').attr('value', 'checkbox').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0]);

    var select = $('<select></select>').attr('tabIndex', 0).addClass(TEST_ELEMENT_CLASS).appendTo(body)[0];

    expectedFocusedElements.push(select);
    $('<option></option>').text('option one').addClass(TEST_ELEMENT_CLASS).appendTo(select);
    $('<option></option>').text('option two').addClass(TEST_ELEMENT_CLASS).appendTo(select);

    var selectMultiple        = $('<select></select>').attr('multiple', 'multiple').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0];
    var optionOneWithTabIndex = $('<option></option>').text('option tab index 2').attr('tabIndex', 3).addClass(TEST_ELEMENT_CLASS).appendTo(selectMultiple)[0];
    var optionTwoWithTabIndex = $('<option></option>').text('option tab index 3').attr('tabIndex', 4).addClass(TEST_ELEMENT_CLASS).appendTo(selectMultiple)[0];

    expectedFocusedElements.push(selectMultiple);

    if (!browserUtils.isIE) {
        expectedFocusedElements.push(optionOneWithTabIndex);
        expectedFocusedElements.push(optionTwoWithTabIndex);
    }

    var hiddenParent = $('<div style="width: 0; height: 0;"></div>').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0];

    //T297258 child of invisible element is unfocusable
    expectedFocusedElements.push($('<input/>').addClass(TEST_ELEMENT_CLASS).appendTo(hiddenParent)[0]);

    var linkWithEmptyHref = $('<a href="">').text('Link without href').addClass(TEST_ELEMENT_CLASS).appendTo(body)[0];

    if (!(browserUtils.isIE && browserUtils.version <= 10))
        expectedFocusedElements.push(linkWithEmptyHref);

    $('<a>').text('Link without href').addClass(TEST_ELEMENT_CLASS).appendTo(body);
    $('<div></div>').text('div tag').addClass(TEST_ELEMENT_CLASS).appendTo(body);
    $('<input type="button">').attr('value', 'button input').attr('tabIndex', -1).addClass(TEST_ELEMENT_CLASS).appendTo(body);

    iframe    = $('<iframe></iframe>').addClass(TEST_ELEMENT_CLASS)[0];
    iframe.id = 'test_unique' + Date.now();

    expectedFocusedElements.push(iframe);
};

QUnit.testStart(function () {
    $('#qunit-tests').css('display', 'none');
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    $('#qunit-tests').css('display', '');
    $('.' + TEST_ELEMENT_CLASS).remove();
    focusedElements         = [];
    expectedFocusedElements = [];
    iframe                  = null;
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

asyncTest('find all focusable elements', function () {
    createElements();

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var allElements = document.querySelectorAll('*');

            focusedElements = allElements.filter(function (el) {
                return domUtils.isElementFocusable(el);
            });

            deepEqual(expectedFocusedElements, focusedElements);
            start();
        });

    document.body.appendChild(iframe);
});
