var DomProcessor = hammerhead.processors.DomProcessor;
var urlUtils     = hammerhead.utils.url;

var nativeMethods  = hammerhead.nativeMethods;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

QUnit.testStart(function () {
    window.name = 'window_name';
});

function createTestedLink () {
    var link = document.createElement('a');

    link.onclick = function () {
        return false;
    };

    document.body.appendChild(link);

    return link;
}

function checkElementTarget (el, real, primary) {
    var tagName = el.tagName.toLowerCase();

    if (tagName === 'a')
        strictEqual(nativeMethods.anchorTargetGetter.call(el), real);
    else if (tagName === 'area')
        strictEqual(nativeMethods.areaTargetGetter.call(el), real);
    else if (tagName === 'base')
        strictEqual(nativeMethods.baseTargetGetter.call(el), real);
    else if (tagName === 'form')
        strictEqual(nativeMethods.formTargetGetter.call(el), real);

    strictEqual(el.getAttribute('target'), primary);
}

function checkElementFormTarget (el, real, primary) {
    var tagName = el.tagName.toLowerCase();

    if (tagName === 'input')
        strictEqual(nativeMethods.inputFormTargetGetter.call(el), real);
    else if (tagName === 'button')
        strictEqual(nativeMethods.buttonFormTargetGetter.call(el), real);

    strictEqual(el.getAttribute('formtarget'), primary);
}

function provokeTargetCalculation (link) {
    link.click();
}

module('"_blank" target attribute');

test('process html', function () {
    var container = document.createElement('div');

    document.body.appendChild(container);

    container.innerHTML = '<a href="about:blank" target="_blank" onclick="return false;"></a>' +
                          '<a href="about:blank" target="unknow_window" onclick="return false;"></a>' +
                          '<a href="about:blank" target="window_name" onclick="return false;"></a>' +
                          '<a href="about:blank" target="_self" onclick="return false;"></a>';

    var children = container.children;

    checkElementTarget(children[0], '_top', '_blank');
    checkElementTarget(children[1], 'unknow_window', 'unknow_window');
    checkElementTarget(children[2], 'window_name', 'window_name');
    checkElementTarget(children[3], '_self', '_self');

    provokeTargetCalculation(children[0]);
    provokeTargetCalculation(children[1]);
    provokeTargetCalculation(children[2]);
    provokeTargetCalculation(children[3]);

    checkElementTarget(children[0], '_top', '_blank');
    checkElementTarget(children[1], '_top', 'unknow_window');
    checkElementTarget(children[2], 'window_name', 'window_name');
    checkElementTarget(children[3], '_self', '_self');

    document.body.removeChild(container);
});

test('change window name', function () {
    var link = createTestedLink();

    link.setAttribute('target', 'window_name');
    checkElementTarget(link, 'window_name', 'window_name');
    provokeTargetCalculation(link);
    checkElementTarget(link, 'window_name', 'window_name');

    window.name = 'unknow_window';
    provokeTargetCalculation(link);
    checkElementTarget(link, '_top', 'window_name');

    window.name = 'window_name';
    provokeTargetCalculation(link);
    checkElementTarget(link, 'window_name', 'window_name');

    document.body.removeChild(link);
});

test('window.open', function () {
    var nativeWindowOpen = nativeMethods.windowOpen;
    var targets          = [];
    var iframe           = document.createElement('iframe');

    iframe.setAttribute('id', 'test' + Date.now());
    iframe.setAttribute('name', '2');
    document.body.appendChild(iframe);

    nativeMethods.windowOpen = function (url, target) {
        targets.push(target);
    };

    window.open('http://some-url.com/', '_self');
    window.open('http://some-url.com/', '_blank');
    window.open('http://some-url.com/', 'window_name');
    window.open('http://some-url.com/', 'unknow_name');
    window.open('http://some-url.com/');
    window.open('http://some-url.com/', 2);

    strictEqual(targets.length, 6);
    strictEqual(targets[0], '_self');
    strictEqual(targets[1], '_top');
    strictEqual(targets[2], 'window_name');
    strictEqual(targets[3], '_top');
    strictEqual(targets[4], '_self');
    strictEqual(targets[5], '2');

    nativeMethods.windowOpen = nativeWindowOpen;
    document.body.removeChild(iframe);
});

test('case insensitive target="_blank"', function () {
    var link = document.createElement('a');

    link.setAttribute('target', '_Blank');
    checkElementTarget(link, '_top', '_Blank');
});

test('all possible elements', function () {
    var tagNames = ['a', 'form', 'area', 'base'];
    var el       = null;

    for (var i = 0; i < tagNames.length; i++) {
        el = document.createElement(tagNames[i]);

        el.setAttribute('target', '_blank');
        checkElementTarget(el, '_top', '_blank');
        provokeTargetCalculation(el);
        checkElementTarget(el, '_top', '_blank');

        el.setAttribute('target', '_self');
        checkElementTarget(el, '_self', '_self');
        provokeTargetCalculation(el);
        checkElementTarget(el, '_self', '_self');

        el.target = '_blank';
        checkElementTarget(el, '_top', '_blank');
        provokeTargetCalculation(el);
        checkElementTarget(el, '_top', '_blank');

        el.setAttribute('target', 'window_name');
        checkElementTarget(el, 'window_name', 'window_name');
        provokeTargetCalculation(el);
        checkElementTarget(el, 'window_name', 'window_name');

        el.setAttribute('target', 'unknow_window');
        checkElementTarget(el, '_top', 'unknow_window');
        provokeTargetCalculation(el);
        checkElementTarget(el, '_top', 'unknow_window');

        el.removeAttribute('target');
        checkElementTarget(el, '', null);
        provokeTargetCalculation(el);
        checkElementTarget(el, '', null);
    }
});


module('"formtarget" attribute');

test('process html', function () {
    var formTargetCases = [
        { real: '_top', primary: '_blank', resourceType: 'f' },
        { real: '_parent', primary: '_parent', resourceType: 'f' },
        { real: '_self', primary: '_self', resourceType: 'f' },
        { real: '_top', primary: '_top', resourceType: 'f' },
        { real: 'unknown_window', primary: 'unknown_window', resourceType: 'f' },
        { real: 'window_name', primary: 'window_name', resourceType: 'if' },
    ];

    var form = document.createElement('form');

    document.body.appendChild(form);

    function checkTag (formTargetCase, tagName) {
        form.innerHTML = '<' + tagName + ' type="submit" formaction="http://input.formaction.com/" formtarget=' +
                         formTargetCase.primary + '>';

        checkElementFormTarget(form.firstChild, formTargetCase.real, formTargetCase.primary);
        strictEqual(urlUtils.parseProxyUrl(nativeMethods.getAttribute.call(form.firstChild, 'formaction')).resourceType, formTargetCase.resourceType);
    }

    formTargetCases.forEach(function (formTargetCase) {
        checkTag(formTargetCase, 'input');
        checkTag(formTargetCase, 'button');
    });

    document.body.removeChild(form);
});

test('setAttribute', function () {
    var form   = document.createElement('form');
    var input  = document.createElement('input');
    var button = document.createElement('button');

    document.body.appendChild(form);

    function testFormtargetAttr (el, real, primary) {
        el.setAttribute('formtarget', primary);

        checkElementFormTarget(el, real, primary);
    }

    [input, button].forEach(function (el) {
        el.type = 'submit';
        form.appendChild(el);

        testFormtargetAttr(el, '_top', '_blank');
        testFormtargetAttr(el, '_parent', '_parent');
        testFormtargetAttr(el, '_self', '_self');
        testFormtargetAttr(el, '_top', '_top');
        testFormtargetAttr(el, 'window_name', 'window_name');
        testFormtargetAttr(el, '_top', 'unknown_window');
    });

    document.body.removeChild(form);
});

test('removeAttribute, hasAttribute', function () {
    var form   = document.createElement('form');
    var input  = document.createElement('input');
    var button = document.createElement('button');

    document.body.appendChild(form);

    input.type  = 'submit';
    button.type = 'submit';

    input.setAttribute('formtarget', '_self');
    button.setAttribute('formtarget', '_self');

    ok(input.hasAttribute('formtarget'));
    ok(button.hasAttribute('formtarget'));

    input.removeAttribute('formtarget');
    button.removeAttribute('formtarget');

    checkElementFormTarget(input, '', null);
    checkElementFormTarget(button, '', null);

    ok(!input.hasAttribute('formtarget'));
    ok(!button.hasAttribute('formtarget'));

    document.body.removeChild(form);
});

test('change the "formaction" resource type after "formtarget" attribute changed', function () {
    var iframe     = document.createElement('iframe');
    var url        = 'http://some.domain.com/index.html';
    var iframeName = 'iframe-window';
    var form       = document.createElement('form');

    iframe.id   = 'test-' + Date.now();
    iframe.name = iframeName;
    document.body.appendChild(iframe);
    document.body.appendChild(form);

    var checkResourceType = function (elFormAction, expected) {
        strictEqual(urlUtils.parseProxyUrl(elFormAction).resourceType, expected);
    };

    var checkElementFormActionResourceType = function (el) {
        form.appendChild(el);

        el.setAttribute('formaction', url);
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'f');

        el.setAttribute('formtarget', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'if');
        el.removeAttribute('formtarget');
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'f');

        el.setAttribute('formtarget', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'if');
        el.setAttribute('formtarget', '');
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'f');

        el.formTarget = iframeName;
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'if');
        el.formTarget = '';
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'f');

        el.setAttribute('formtarget', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'if');
        el.setAttribute('formtarget', '_Self');
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'f');

        el.setAttribute('formtarget', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'if');
        el.setAttribute('formtarget', '_parent');
        checkResourceType(nativeMethods.getAttribute.call(el, 'formaction'), 'f');

        el.parentNode.removeChild(el);
    };

    checkElementFormActionResourceType(document.createElement('input'));
    checkElementFormActionResourceType(document.createElement('button'));

    iframe.parentNode.removeChild(iframe);
});


module('should ensure that target contains the existing window name (GH-247) (GH-745)');

asyncTest('input without form', function () {
    var input = document.createElement('input');

    input.addEventListener('click', function (e) {
        ok(!input.target);

        var storedTarget = nativeMethods.getAttribute.call(input, DomProcessor.getStoredAttrName('target'));

        ok(!storedTarget);

        e.preventDefault();
        input.parentNode.removeChild(input);
        start();
    });
    document.body.appendChild(input);

    eventSimulator.click(input);
});

asyncTest('input inside form', function () {
    var form  = document.createElement('form');
    var input = document.createElement('input');

    form.appendChild(input);
    nativeMethods.formTargetSetter.call(form, '_blank');
    input.type = 'submit';
    document.body.appendChild(form);

    form.addEventListener('submit', function (e) {
        checkElementTarget(form, '_top', '_blank');

        e.preventDefault();
        form.parentNode.removeChild(form);
        start();
    });

    input.click();
});

asyncTest('form.submit', function () {
    var form                   = document.createElement('form');
    var storedNativeFormSubmit = nativeMethods.formSubmit;

    nativeMethods.formSubmit = function () {
        strictEqual(nativeMethods.formTargetGetter.call(form), '_top');

        nativeMethods.formSubmit = storedNativeFormSubmit;
        form.parentNode.removeChild(form);
        start();
    };

    nativeMethods.formTargetSetter.call(form, 'wrong_window_name');
    form.action = 'http://example.com';

    document.body.appendChild(form);
    form.submit();
});


module('regression');

test('change href after target attribute changed (GH-534)', function () {
    var iframe     = document.createElement('iframe');
    var url        = 'http://some.domain.com/index.html';
    var iframeName = 'iframe-window';

    iframe.id   = 'test-' + Date.now();
    iframe.name = iframeName;
    document.body.appendChild(iframe);

    var checkResourceType = function (elUrl, hasFormFlag, hasIframeFlag) {
        var expected = null;

        if (hasIframeFlag)
            expected = 'i';

        if (hasFormFlag)
            expected = (expected || '') + 'f';

        strictEqual(urlUtils.parseProxyUrl(elUrl).resourceType, expected);
    };

    var checkElement = function (el, attr, hasFormFlag, hasIframeFlag) {
        el.setAttribute(attr, url);
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag);

        el.setAttribute('target', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag, hasIframeFlag);
        el.removeAttribute('target');
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag);

        el.setAttribute('target', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag, hasIframeFlag);
        el.setAttribute('target', '');
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag);

        el.target = iframeName;
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag, hasIframeFlag);
        el.target = '';
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag);

        el.setAttribute('target', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag, hasIframeFlag);
        el.setAttribute('target', '_Self');
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag);
    };

    checkElement(document.createElement('form'), 'action', true, true);
    checkElement(document.createElement('a'), 'href', false, true);
    checkElement(document.createElement('base'), 'href', false, false);
    checkElement(document.createElement('area'), 'href', false, true);

    iframe.parentNode.removeChild(iframe);
});

test('The form in the iframe (GH-880)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var form = iframe.contentDocument.createElement('form');

            iframe.contentDocument.body.appendChild(form);
            form.setAttribute('action', 'http://some-domian.com/');
            form.onsubmit = function () {
                return false;
            };

            strictEqual(urlUtils.parseProxyUrl(nativeMethods.formActionGetter.call(form)).resourceType, 'if');
            form.submit();
            strictEqual(urlUtils.parseProxyUrl(nativeMethods.formActionGetter.call(form)).resourceType, 'if');
        });
});

test('should not add target attribute after click on the anchor element', function () {
    var link = createTestedLink();

    provokeTargetCalculation(link);
    checkElementTarget(link, '', null);

    link.parentNode.removeChild(link);
});

test('should not add target attribute after click on the button element (GH-1437)', function () {
    var button = document.createElement('button');

    document.body.appendChild(button);

    provokeTargetCalculation(button);
    checkElementTarget(button, void 0, null);

    document.body.removeChild(button);
});
