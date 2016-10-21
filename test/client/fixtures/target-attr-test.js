var urlUtils = hammerhead.get('./utils/url');

var iframeSandbox  = hammerhead.sandbox.iframe;
var nativeMethods  = hammerhead.nativeMethods;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

QUnit.testStart(function () {
    window.name = 'window_name';
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

function createTestedLink () {
    var link = document.createElement('a');

    link.onclick = function () {
        return false;
    };

    document.body.appendChild(link);

    return link;
}

function checkLinkTarget (link, real, primary) {
    strictEqual(link.target, real);
    strictEqual(link.getAttribute('target'), primary);
}

function provokeTargetCalculation (link) {
    link.click();
}

module('"_blank" target attribute');

test('set attribute', function () {
    var link = createTestedLink();

    link.setAttribute('target', '_blank');
    checkLinkTarget(link, '_top', '_blank');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', '_blank');

    link.setAttribute('target', 'window_name');
    checkLinkTarget(link, 'window_name', 'window_name');
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

    link.setAttribute('target', 'unknow_window');
    checkLinkTarget(link, '_top', 'unknow_window');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', 'unknow_window');

    link.setAttribute('target', '_self');
    checkLinkTarget(link, '_self', '_self');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_self', '_self');

    document.body.removeChild(link);
});

test('set property', function () {
    var link = createTestedLink();

    setProperty(link, 'target', '_blank');
    checkLinkTarget(link, '_top', '_blank');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', '_blank');

    setProperty(link, 'target', 'window_name');
    checkLinkTarget(link, 'window_name', 'window_name');
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

    setProperty(link, 'target', 'unknow_window');
    checkLinkTarget(link, '_top', 'unknow_window');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', 'unknow_window');

    setProperty(link, 'target', '_self');
    checkLinkTarget(link, '_self', '_self');
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_self', '_self');

    document.body.removeChild(link);
});

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

    checkLinkTarget(children[0], '_top', '_blank');
    checkLinkTarget(children[1], 'unknow_window', 'unknow_window');
    checkLinkTarget(children[2], 'window_name', 'window_name');
    checkLinkTarget(children[3], '_self', '_self');

    provokeTargetCalculation(children[0]);
    provokeTargetCalculation(children[1]);
    provokeTargetCalculation(children[2]);
    provokeTargetCalculation(children[3]);

    checkLinkTarget(children[0], '_top', '_blank');
    checkLinkTarget(children[1], '_top', 'unknow_window');
    checkLinkTarget(children[2], 'window_name', 'window_name');
    checkLinkTarget(children[3], '_self', '_self');

    document.body.removeChild(container);
});

test('change window name', function () {
    var link = createTestedLink();

    link.setAttribute('target', 'window_name');
    checkLinkTarget(link, 'window_name', 'window_name');
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

    window.name = 'unknow_window';
    provokeTargetCalculation(link);
    checkLinkTarget(link, '_top', 'window_name');

    window.name = 'window_name';
    provokeTargetCalculation(link);
    checkLinkTarget(link, 'window_name', 'window_name');

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
    checkLinkTarget(link, '_top', '_Blank');
});

test('all possible elements', function () {
    var tagNames = ['a', 'form', 'area', 'base'];
    var el       = null;

    for (var i = 0; i < tagNames.length; i++) {
        el = document.createElement(tagNames[i]);

        el.setAttribute('target', '_blank');
        checkLinkTarget(el, '_top', '_blank');

        el.setAttribute('target', '_self');
        checkLinkTarget(el, '_self', '_self');

        setProperty(el, 'target', '_blank');
        checkLinkTarget(el, '_top', '_blank');
    }
});

module('should ensure that target contains the existing window name (GH-247) (GH-745)', function () {
    test('link', function () {
        var link = document.createElement('a');

        link.href   = 'http://example.com';
        link.target = 'wrong_window_name';
        link.addEventListener('click', function (e) {
            strictEqual(link.target, '_top');

            e.preventDefault();
            link.parentNode.removeChild(link);
        });
        document.body.appendChild(link);

        eventSimulator.click(link);
    });

    test('link with keyword target', function () {
        var link = document.createElement('a');

        link.href   = 'http://example.com';
        link.target = '_Parent';
        link.addEventListener('click', function (e) {
            strictEqual(link.target, '_Parent');

            e.preventDefault();
            link.parentNode.removeChild(link);
        });
        document.body.appendChild(link);

        eventSimulator.click(link);
    });

    test('base', function () {
        var link = document.createElement('a');
        var base = document.createElement('base');

        base.target = 'wrong_window_name';
        link.href   = 'http://example.com';
        link.addEventListener('click', function (e) {
            strictEqual(link.target, '_top');

            e.preventDefault();
            link.parentNode.removeChild(link);
        });

        document.body.appendChild(link);
        document.body.appendChild(base);

        eventSimulator.click(link);
    });

    // TODO:
    //test('base with keyword target', function () {
    //    var link = document.createElement('a');
    //    var base = document.createElement('base');
    //
    //    base.target = '_Parent';
    //    link.href   = 'http://example.com';
    //    link.addEventListener('click', function (e) {
    //        strictEqual(link.target, '_self');
    //
    //        e.preventDefault();
    //        link.parentNode.removeChild(link);
    //    });
    //
    //    document.body.appendChild(link);
    //    document.body.appendChild(base);
    //
    //    eventSimulator.click(link);
    //});

    test('effective target', function () {
        var link = document.createElement('a');
        var base = document.createElement('base');

        base.target = '_Parent';
        link.target = '_top';
        link.href   = 'http://example.com';
        link.addEventListener('click', function (e) {
            strictEqual(link.target, '_top');

            e.preventDefault();
            link.parentNode.removeChild(link);
        });

        document.body.appendChild(link);
        document.body.appendChild(base);

        eventSimulator.click(link);
    });

    test('area', function () {
        var area = document.createElement('area');
        var map  = document.createElement('map');
        var img  = document.createElement('img');

        map.name    = 'test_cafe_logo';
        img.src     = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
        img.useMap  = 'test_cafe_logo';
        area.coords = '0,0,100,100';
        area.shape  = 'rect';
        area.target = 'wrong_window_name';
        area.href   = 'http://example.com';
        area.addEventListener('click', function (e) {
            strictEqual(area.target, '_top');

            e.preventDefault();
            map.parentNode.removeChild(map);
            img.parentNode.removeChild(img);
        });

        map.appendChild(area);
        document.body.appendChild(img);
        document.body.appendChild(map);

        eventSimulator.click(area);
    });

    // TODO:
    //test('form', function () {
    //    var form  = document.createElement('form');
    //    var input = document.createElement('input');
    //
    //    input.type  = 'submit';
    //    form.target = 'wrong_window_name';
    //    form.action = 'http://example.com';
    //    form.appendChild(input);
    //
    //    form.addEventListener('submit', function (e) {
    //        strictEqual(form.target, '_top');
    //
    //        e.preventDefault();
    //        form.parentNode.removeChild(form);
    //    });
    //    document.body.appendChild(form);
    //    form.submit();
    //});

    test('input without form', function () {
        var input = document.createElement('input');

        input.addEventListener('click', function (e) {
            ok(!input.target);

            e.preventDefault();
            input.parentNode.removeChild(input);
        });
        document.body.appendChild(input);

        eventSimulator.click(input);
    });

    asyncTest('form.submit', function () {
        var form                   = document.createElement('form');
        var storedNativeFormSubmit = nativeMethods.formSubmit;

        nativeMethods.formSubmit = function () {
            strictEqual(form.target, '_top');

            nativeMethods.formSubmit = storedNativeFormSubmit;
            start();
        };

        form.target = 'wrong_window_name';
        form.action = 'http://example.com';

        document.body.appendChild(form);
        form.submit();
    });
});

module('regression');

test('change href after target attribute changed (GH-534)', function () {
    var iframe = document.createElement('iframe');
    var check  = function (setTarget, clearTarget) {
        var form = document.createElement('form');
        var link = document.createElement('a');
        var base = document.createElement('base');
        var area = document.createElement('area');
        var url  = 'http://some.domain.com/index.html';

        form.setAttribute('action', url);
        link.setAttribute('href', url);
        base.setAttribute('href', url);
        area.setAttribute('href', url);

        strictEqual(urlUtils.parseProxyUrl(form.action).resourceType, 'f');
        strictEqual(urlUtils.parseProxyUrl(link.href).resourceType, null);
        strictEqual(urlUtils.parseProxyUrl(base.href).resourceType, null);
        strictEqual(urlUtils.parseProxyUrl(area.href).resourceType, null);

        setTarget(form);
        setTarget(link);
        setTarget(base);
        setTarget(area);

        strictEqual(urlUtils.parseProxyUrl(form.action).resourceType, 'if');
        strictEqual(urlUtils.parseProxyUrl(link.href).resourceType, 'i');
        strictEqual(urlUtils.parseProxyUrl(base.href).resourceType, 'i');
        strictEqual(urlUtils.parseProxyUrl(area.href).resourceType, 'i');

        clearTarget(form);
        clearTarget(link);
        clearTarget(base);
        clearTarget(area);

        strictEqual(urlUtils.parseProxyUrl(form.action).resourceType, 'f');
        strictEqual(urlUtils.parseProxyUrl(link.href).resourceType, null);
        strictEqual(urlUtils.parseProxyUrl(base.href).resourceType, null);
        strictEqual(urlUtils.parseProxyUrl(area.href).resourceType, null);
    };

    iframe.id   = 'test-' + Date.now();
    iframe.name = 'test-window';
    document.body.appendChild(iframe);

    check(function (el) {
        el.setAttribute('target', 'test-window');
    }, function (el) {
        el.removeAttribute('target');
    });

    check(function (el) {
        el.setAttribute('target', 'test-window');
    }, function (el) {
        el.setAttribute('target', '');
    });

    check(function (el) {
        setProperty(el, 'target', 'test-window');
    }, function (el) {
        setProperty(el, 'target', '');
    });

    check(function (el) {
        el.setAttribute('target', 'test-window');
    }, function (el) {
        el.setAttribute('target', '_Self');
    });

    iframe.parentNode.removeChild(iframe);
});

asyncTest('The form in the iframe (GH-880)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test-' + Date.now();

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var form      = iframe.contentDocument.createElement('form');

            iframe.contentDocument.body.appendChild(form);
            form.setAttribute('action', 'http://some-domian.com/');
            form.onsubmit = function () {
                return false;
            };

            strictEqual(urlUtils.parseProxyUrl(form.action).resourceType, 'if');
            form.submit();
            strictEqual(urlUtils.parseProxyUrl(form.action).resourceType, 'if');

            iframe.parentNode.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
});
