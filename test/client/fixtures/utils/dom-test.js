var INTERNAL_PROPS = Hammerhead.get('../processing/dom/internal-properties');

var domUtils      = Hammerhead.utils.dom;
var iframeSandbox = Hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

asyncTest('isCrossDomainWindows', function () {
    var crossDomainIframe = document.createElement('iframe');

    crossDomainIframe.id = 'test1';

    var iframeWithEmptySrc = document.createElement('iframe');

    iframeWithEmptySrc.id = 'test2';

    var iframeAboutBlank = document.createElement('iframe');

    iframeAboutBlank.id = 'test3';

    ok(!domUtils.isCrossDomainWindows(window, window));

    iframeWithEmptySrc.src = '';
    document.body.appendChild(iframeWithEmptySrc);

    ok(!domUtils.isCrossDomainWindows(window, iframeWithEmptySrc.contentWindow));

    iframeAboutBlank.src = 'about:blank';
    document.body.appendChild(iframeAboutBlank);

    ok(!domUtils.isCrossDomainWindows(window, iframeAboutBlank.contentWindow));

    crossDomainIframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/get-message.html');
    document.body.appendChild(crossDomainIframe);

    crossDomainIframe.addEventListener('load', function () {
        ok(domUtils.isCrossDomainWindows(window, crossDomainIframe.contentWindow));

        crossDomainIframe.parentNode.removeChild(crossDomainIframe);
        iframeWithEmptySrc.parentNode.removeChild(iframeWithEmptySrc);
        iframeAboutBlank.parentNode.removeChild(iframeAboutBlank);

        start();
    });
});

test('isDomElement', function () {
    ok(domUtils.isDomElement(document.body));
    ok(domUtils.isDomElement(document.createElement('span')));
    ok(domUtils.isDomElement(document.createElement('strong')));
    ok(domUtils.isDomElement(document.createElement('a')));
    ok(!domUtils.isDomElement(null));

    //T184805
    var p = Element.prototype;

    /* eslint-disable no-extra-parens */
    do
        ok(!domUtils.isDomElement(p));
    while ((p = Object.getPrototypeOf(p)));
    /* eslint-enable no-extra-parens */
});

asyncTest('isDomElement for iframe Element.prototype chain', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test4';
    iframe.src = '';
    iframe.addEventListener('load', function () {
        var p = this.contentWindow.Element.prototype;

        /* eslint-disable no-extra-parens */
        do
            ok(!domUtils.isDomElement(p));
        while ((p = Object.getPrototypeOf(p)));
        /* eslint-enable no-extra-parens */

        this.parentNode.removeChild(this);
        start();
    });

    document.body.appendChild(iframe);
});

asyncTest('getTopSameDomainWindow', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test5';
    iframe.addEventListener('load', function () {
        strictEqual(domUtils.getTopSameDomainWindow(window.top), window.top);
        strictEqual(domUtils.getTopSameDomainWindow(this.contentWindow), window.top);

        iframe.parentNode.removeChild(iframe);
        start();
    });
    document.body.appendChild(iframe);
});

test('isWindow', function () {
    ok(domUtils.isWindow(window));
    ok(!domUtils.isWindow({ top: '' }));

    var storedToString = window.toString;

    window.toString = function () {
        throw 'eid library overrides window.toString() method';
    };

    ok(domUtils.isWindow(window));

    window.toString = storedToString;
});

test('closest element', function () {
    var div = document.createElement('div');

    div.className = 'parent';
    div           = document.body.appendChild(div);

    var innerDiv = document.createElement('div');

    innerDiv.className = 'child';
    div.appendChild(innerDiv);

    ok(!domUtils.closest(null, '.test'));
    strictEqual(domUtils.closest(innerDiv, '.parent'), div);
    strictEqual(domUtils.closest(div, 'html'), document.documentElement);

    var iframe = document.createElement('iframe');

    iframe.id = 'test5';
    iframe    = document.body.appendChild(iframe);

    var iframeDiv = iframe.contentDocument.createElement('div');

    iframeDiv.className = 'parent';

    // NOTE: IE9, IE10.
    if (!iframe.contentDocument.body) {
        var body = iframe.contentDocument.createElement('body');

        iframe.contentDocument.appendChild(body);
    }

    iframeDiv = iframe.contentDocument.body.appendChild(iframeDiv);

    var innerIframeDiv = iframe.contentDocument.createElement('div');

    innerIframeDiv.className = 'child';
    iframeDiv.appendChild(innerIframeDiv);

    strictEqual(domUtils.closest(innerIframeDiv, '.parent'), iframeDiv);
    strictEqual(domUtils.closest(iframeDiv, 'body'), iframe.contentDocument.body);

    iframe.parentNode.removeChild(iframe);
    div.parentNode.removeChild(div);
});

module('isIframeWithoutSrc');

asyncTest('changed location 2', function () {
    var handler = function () {
        this.removeEventListener('load', handler);
        this.addEventListener('load', function () {
            this[INTERNAL_PROPS.processedContext] = window;
            ok(!domUtils.isIframeWithoutSrc(this));
            ok(!domUtils.isCrossDomainIframe(this));
            this.parentNode.removeChild(this);
            start();
        });

        this.contentWindow.location = 'http://' + location.host + '/';
    };

    var iframe = document.createElement('iframe');

    iframe.id  = 'test7';
    iframe.src = 'about:blank';
    iframe.addEventListener('load', handler);
    document.body.appendChild(iframe);
});

asyncTest('crossdomain src', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test8';
    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/simple-page.html');
    iframe.addEventListener('load', function () {
        this[INTERNAL_PROPS.processedContext] = window;
        ok(!domUtils.isIframeWithoutSrc(this));
        ok(domUtils.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);

        start();
    });
    document.body.appendChild(iframe);
});

asyncTest('samedomain src', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test9';
    iframe.src = 'http://' + location.host + '/';
    iframe.addEventListener('load', function () {
        this[INTERNAL_PROPS.processedContext] = window;
        ok(!domUtils.isIframeWithoutSrc(this));
        ok(!domUtils.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);

        start();
    });
    document.body.appendChild(iframe);
});

asyncTest('without src attribute', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test10';
    iframe.addEventListener('load', function () {
        this[INTERNAL_PROPS.processedContext] = window;
        ok(domUtils.isIframeWithoutSrc(this));
        ok(!domUtils.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);
        start();
    });
    document.body.appendChild(iframe);
});

asyncTest('about:blank', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test11';
    iframe.src = 'about:blank';
    iframe.addEventListener('load', function () {
        this[INTERNAL_PROPS.processedContext] = window;
        ok(domUtils.isIframeWithoutSrc(this));
        ok(!domUtils.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);
        start();
    });
    document.body.appendChild(iframe);
});

module('isCrossDomainIframe');

asyncTest('location is changed to cross-domain', function () {
    expect(4);

    var iteration = 0;
    var iframe    = document.createElement('iframe');

    iframe.id  = 'test12';
    iframe.src = 'http://' + location.host + '/';
    iframe.addEventListener('load', function () {
        if (!iteration) {
            ok(!domUtils.isCrossDomainIframe(this));
            ok(!domUtils.isCrossDomainIframe(this, true));
            this.contentDocument.location.href = window.getCrossDomainPageUrl('../../data/cross-domain/simple-page.html');
            iteration++;
        }
        else {
            ok(domUtils.isCrossDomainIframe(this));
            ok(!domUtils.isCrossDomainIframe(this, true));
            this.parentNode.removeChild(this);
            start();
        }
    });
    document.body.appendChild(iframe);
});

asyncTest('empty src attribute', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test13';
    iframe.src = '';
    iframe.addEventListener('load', function () {
        this[INTERNAL_PROPS.processedContext] = window;
        ok(domUtils.isIframeWithoutSrc(this));
        ok(!domUtils.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);
        start();
    });
    document.body.appendChild(iframe);
});

module('class manipulation');

test('addClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    domUtils.addClass(null, 'test');
    strictEqual(div.className, '');

    domUtils.addClass(div, 'test');
    strictEqual(div.className, 'test');

    div.className = 'test1';
    domUtils.addClass(div, 'test2 test3');
    strictEqual(div.className, 'test1 test2 test3');

    div.className = 'test1 test2';
    domUtils.addClass(div, 'test2 test3');
    strictEqual(div.className, 'test1 test2 test3');

    div.parentNode.removeChild(div);
});

test('removeClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    domUtils.removeClass(null, 'test');
    domUtils.removeClass(div, 'test');
    strictEqual(div.className, '');

    div.className = 'test';
    domUtils.removeClass(div, 'test');
    strictEqual(div.className, '');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test1');
    strictEqual(div.className, 'test2 test3');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test2');
    strictEqual(div.className, 'test1 test3');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test3');
    strictEqual(div.className, 'test1 test2');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test1 test3');
    strictEqual(div.className, 'test2');

    div.parentNode.removeChild(div);
});

test('hasClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    ok(!domUtils.hasClass(null, 'test'));

    div.className = 'test';
    ok(domUtils.hasClass(div, 'test'));

    div.className = 'test1 test2 test3';
    ok(domUtils.hasClass(div, 'test1'));
    ok(domUtils.hasClass(div, 'test2'));
    ok(domUtils.hasClass(div, 'test3'));

    div.parentNode.removeChild(div);
});

module('regression');

test('IsDomElement for <object> tag (B252941)', function () {
    var objectElement = document.createElement('object');

    document.body.appendChild(objectElement);

    ok(domUtils.isDomElement(objectElement));

    objectElement.parentNode.removeChild(objectElement);
});

test('IsDomElement for object that simulate HTMLInputElement (T230802)', function () {
    /* eslint-disable no-unused-vars */
    var obj = {
        size:    null,
        tagName: 'input',
        type:    'text',
        value:   ''
    };

    strictEqual(eval(processScript('obj.value')), '');
    /* eslint-enable no-unused-vars */
});

test('IsDomElement for plain object (T198784)', function () {
    /* eslint-disable no-unused-vars */
    var obj = {
        target:  'ok',
        tagName: -1
    };

    strictEqual(eval(processScript('obj.target')), 'ok');
    /* eslint-enable no-unused-vars */
});

asyncTest('Cross domain iframe that contains iframe without src should not throw the security error (GH-114)', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/page-with-iframe-with-js-protocol.html');

    window.addEventListener('message', function (e) {
        strictEqual(e.data, 'ok');

        document.body.removeChild(iframe);

        start();
    });

    document.body.appendChild(iframe);
});
