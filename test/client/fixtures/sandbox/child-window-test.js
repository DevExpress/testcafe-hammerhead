var ChildWindowSandbox = hammerhead.sandboxes.ChildWindowSandbox;
var defaultTarget      = hammerhead.sandboxUtils.defaultTarget;
var settings           = hammerhead.settings;
var Promise            = hammerhead.Promise;

var windowSandbox = hammerhead.sandbox.node.win;
var nativeMethods = hammerhead.nativeMethods;

var delay = function (ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
};

test('_shouldOpenInNewWindow', function () {
    window.name = 'test-window-name';

    notOk(ChildWindowSandbox._shouldOpenInNewWindow(null, defaultTarget.linkOrArea));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow('', defaultTarget.linkOrArea));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('_blank', defaultTarget.linkOrArea));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('_Blank', defaultTarget.linkOrArea));
    ok(ChildWindowSandbox._shouldOpenInNewWindow('wrong-window-name', defaultTarget.linkOrArea));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow('test-window-name', defaultTarget.linkOrArea));
    notOk(ChildWindowSandbox._shouldOpenInNewWindow(null, defaultTarget.form));
    ok(ChildWindowSandbox._shouldOpenInNewWindow(null, defaultTarget.windowOpen));

    window.name = '';
});

test('should not open new window if link has the `download` attribute', function () {
    var link = document.createElement('a');

    link.setAttribute('download', 'download');
    link.setAttribute('target', '_blank');
    notOk(ChildWindowSandbox._shouldOpenInNewWindowOnElementAction(link, defaultTarget.linkOrArea));

    link.setAttribute('download', '');
    notOk(ChildWindowSandbox._shouldOpenInNewWindowOnElementAction(link, defaultTarget.linkOrArea));

    link.removeAttribute('download');
    ok(ChildWindowSandbox._shouldOpenInNewWindowOnElementAction(link, defaultTarget.linkOrArea));
});

test('window.open', function () {
    settings.get().allowMultipleWindows = true;

    var storedHandleWindowOpen = windowSandbox._childWindowSandbox.handleWindowOpen;

    windowSandbox._childWindowSandbox.handleWindowOpen = function (window, args) {
        strictEqual(args[1], '_blank');
    };

    window.open('/test');

    windowSandbox._childWindowSandbox.handleWindowOpen = storedHandleWindowOpen;

    settings.get().allowMultipleWindows = false;
});

test('Should open a new window in Native Automation by clicking a link', function () {
    settings.get().nativeAutomation     = true;
    settings.get().allowMultipleWindows = true;

    var storedOpenUrlInNewWindow = windowSandbox._childWindowSandbox._openUrlInNewWindow;
    var handled = false;

    hammerhead.sandbox.childWindow._openUrlInNewWindow = function () {
        handled = true;
    };

    var link  = document.createElement('a');

    link.innerText = 'link';
    link.href      = 'http://example.com';
    link.target    = '_blank';

    document.body.appendChild(link);

    nativeMethods.click.call(link);

    windowSandbox._childWindowSandbox._openUrlInNewWindow = storedOpenUrlInNewWindow;

    settings.get().nativeAutomation     = false;
    settings.get().allowMultipleWindows = false;

    document.body.removeChild(link);

    strictEqual(handled, true);
});

test('open child window considering base element', function () {
    settings.get().allowMultipleWindows = true;

    hammerhead.sandbox.childWindow._handleFormSubmitting(window);

    var openedWindowUrl          = '';
    var storedOpenUrlInNewWindow = windowSandbox._childWindowSandbox._openUrlInNewWindow;

    hammerhead.sandbox.childWindow._openUrlInNewWindow = function (url) {
        openedWindowUrl = url;

        return {
            windowId: Date.now(),
        };
    };

    var base  = document.createElement('base');
    var link  = document.createElement('a');
    var form  = document.createElement('form');
    var input = document.createElement('input');

    form.addEventListener('submit', function (event) {
        event.preventDefault();
    });

    base.target    = '_blank';
    link.innerText = 'link';
    link.href      = 'http://link';
    form.action    = 'http://form';
    form.method    = 'get';
    input.type     = 'submit';

    document.head.appendChild(base);
    document.body.appendChild(link);
    document.body.appendChild(form);
    form.appendChild(input);

    nativeMethods.click.call(link);
    ok(openedWindowUrl.indexOf('http://link') > -1);

    // NOTE: new window after form submit opens in the `about:blank` page
    nativeMethods.click.call(input);
    ok(openedWindowUrl.indexOf('about:blank') > -1);

    windowSandbox._childWindowSandbox._openUrlInNewWindow = storedOpenUrlInNewWindow;

    settings.get().allowMultipleWindows = false;

    document.body.removeChild(link);
    document.body.removeChild(form);
});

test('Should not open in window if the default behavior was prevented', function () {
    settings.get().allowMultipleWindows = true;

    var windowOpenCounter        = 0;
    var openedWindowUrl          = '';
    var storedOpenUrlInNewWindow = windowSandbox._childWindowSandbox._openUrlInNewWindow;

    hammerhead.sandbox.childWindow._openUrlInNewWindow = function (url) {
        windowOpenCounter++;

        openedWindowUrl = url;

        return {
            windowId: Date.now(),
        };
    };

    var link  = document.createElement('a');

    link.innerText = 'link';
    link.href      = 'http://example.com';
    link.target    = '_blank';

    link.addEventListener('click', function (e) {
        window.open('http://link');

        e.preventDefault();
    });

    document.body.appendChild(link);

    nativeMethods.click.call(link);
    ok(openedWindowUrl.indexOf('http://link') > -1);
    strictEqual(windowOpenCounter, 1);

    windowSandbox._childWindowSandbox._openUrlInNewWindow = storedOpenUrlInNewWindow;

    settings.get().allowMultipleWindows = false;

    document.body.removeChild(link);
});

test('Should not open in window if the default behavior was prevented in parent element handler', function () {
    settings.get().allowMultipleWindows = true;

    var windowOpenCounter        = 0;
    var storedOpenUrlInNewWindow = windowSandbox._childWindowSandbox._openUrlInNewWindow;

    hammerhead.sandbox.childWindow._openUrlInNewWindow = function () {
        windowOpenCounter++;

        return {
            windowId: Date.now(),
        };
    };

    var link  = document.createElement('a');
    var div1  = document.createElement('div');
    var div2  = document.createElement('div');
    var div3  = document.createElement('div');

    link.innerText = 'link';
    link.href      = 'http://example.com';
    link.target    = '_blank';

    div1.addEventListener('click', function (e) {
        e.preventDefault();
    });

    div2.addEventListener('click', function (e) {
        e.stopPropagation();

        e.preventDefault();
    });

    div3.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    div1.appendChild(link);
    document.body.appendChild(div1);
    nativeMethods.click.call(link);

    document.body.removeChild(div1);
    strictEqual(windowOpenCounter, 0);

    div2.appendChild(link);
    document.body.appendChild(div2);
    nativeMethods.click.call(link);

    return delay(10)
        .then(function () {
            document.body.removeChild(div2);
            strictEqual(windowOpenCounter, 0);

            div3.appendChild(link);
            document.body.appendChild(div3);
            nativeMethods.click.call(link);

            return delay(10);
        })
        .then(function () {
            document.body.removeChild(div3);
            strictEqual(windowOpenCounter, 1);

            windowSandbox._childWindowSandbox._openUrlInNewWindow = storedOpenUrlInNewWindow;

            settings.get().allowMultipleWindows = false;
        });
});

module('regression');

test('should be prevented only default behaviour (GH-2467)', function () {
    settings.get().allowMultipleWindows = true;

    var anchor                   = document.createElement('a');
    var isClickTriggered         = false;
    var storedOpenUrlInNewWindow = windowSandbox._childWindowSandbox._openUrlInNewWindow;

    anchor.href        = '/path/';
    anchor.target      = '_blank';
    anchor.textContent = 'click';

    document.body.appendChild(anchor);

    anchor.addEventListener('click', function () {
        isClickTriggered = true;
    });

    windowSandbox._childWindowSandbox._openUrlInNewWindow = window.noop;

    nativeMethods.click.call(anchor);

    return window.QUnitGlobals.wait(function () {
        return isClickTriggered;
    }, 5000)
        .then(function () {
            ok(true);

            settings.get().allowMultipleWindows = false;
            windowSandbox._childWindowSandbox._openUrlInNewWindow = storedOpenUrlInNewWindow;
            document.body.removeChild(anchor);
        });
});

test('prevent window.open', function () {
    settings.get().allowMultipleWindows = true;

    var handled = false;

    function beforeWindowOpenedHandler (e) {
        handled = true;

        e.isPrevented = true;
    }

    windowSandbox._childWindowSandbox.on(hammerhead.EVENTS.beforeWindowOpened, beforeWindowOpenedHandler);

    var wnd = window.open('/test');

    notOk(wnd);
    ok(handled);

    windowSandbox._childWindowSandbox.off(hammerhead.EVENTS.beforeWindowOpened, beforeWindowOpenedHandler);

    settings.get().allowMultipleWindows = false;
});
