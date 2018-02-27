var DomProcessor = hammerhead.get('../processing/dom');
var urlUtils     = hammerhead.get('./utils/url');

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
    if (el.tagName === 'anchor')
        strictEqual(nativeMethods.anchorTargetGetter.call(el), real);
    else if (el.tagName === 'area')
        strictEqual(nativeMethods.areaTargetGetter.call(el), real);
    else if (el.tagName === 'base')
        strictEqual(nativeMethods.baseTargetGetter.call(el), real);
    else if (el.tagName === 'form')
        strictEqual(nativeMethods.formTargetGetter.call(el), real);

    strictEqual(el.getAttribute('target'), primary);
}

function provokeTargetCalculation (link) {
    link.click();
}

module('"_blank" target attribute');

test('process html', function () {
    var container = document.createElement('div');

    document.body.appendChild(container);

    setProperty(container, 'innerHTML',
        '<a href="about:blank" target="_blank" onclick="return false;"></a>' +
        '<a href="about:blank" target="unknow_window" onclick="return false;"></a>' +
        '<a href="about:blank" target="window_name" onclick="return false;"></a>' +
        '<a href="about:blank" target="_self" onclick="return false;"></a>'
    );

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

    nativeMethods.windowOpen = function (url, target) {
        targets.push(target);
    };

    window.open('http://some-url.com/', '_self');
    window.open('http://some-url.com/', '_blank');
    window.open('http://some-url.com/', 'window_name');
    window.open('http://some-url.com/', 'unknow_name');
    window.open('http://some-url.com/');

    strictEqual(targets.length, 5);
    strictEqual(targets[0], '_self');
    strictEqual(targets[1], '_top');
    strictEqual(targets[2], 'window_name');
    strictEqual(targets[3], '_top');
    strictEqual(targets[4], '_self');

    nativeMethods.windowOpen = nativeWindowOpen;
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

        setProperty(el, 'target', '_blank');
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

        setProperty(el, 'target', iframeName);
        checkResourceType(nativeMethods.getAttribute.call(el, attr), hasFormFlag, hasIframeFlag);
        setProperty(el, 'target', '');
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

            strictEqual(urlUtils.parseProxyUrl(form.action).resourceType, 'if');
            form.submit();
            strictEqual(urlUtils.parseProxyUrl(form.action).resourceType, 'if');
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
