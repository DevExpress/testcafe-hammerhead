var DOM           = Hammerhead.get('./util/dom');
var IFrameSandbox = Hammerhead.get('./sandboxes/iframe');
var Const         = Hammerhead.get('../const');
var UrlUtil       = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

asyncTest('isCrossDomainWindows', function () {
    var crossDomainIframe = document.createElement('iframe');

    crossDomainIframe.id = 'test1';

    var iframeWithEmptySrc = document.createElement('iframe');

    iframeWithEmptySrc.id = 'test2';

    var iframeAboutBlank = document.createElement('iframe');

    iframeAboutBlank.id = 'test3';

    ok(!DOM.isCrossDomainWindows(window, window));

    iframeWithEmptySrc.src = '';
    document.body.appendChild(iframeWithEmptySrc);

    ok(!DOM.isCrossDomainWindows(window, iframeWithEmptySrc.contentWindow));

    iframeAboutBlank.src = 'about:blank';
    document.body.appendChild(iframeAboutBlank);

    ok(!DOM.isCrossDomainWindows(window, iframeAboutBlank.contentWindow));

    crossDomainIframe.src = window.getCrossDomainPageUrl('get-message.html');
    document.body.appendChild(crossDomainIframe);

    crossDomainIframe.addEventListener('load', function () {
        ok(DOM.isCrossDomainWindows(window, crossDomainIframe.contentWindow));

        crossDomainIframe.parentNode.removeChild(crossDomainIframe);
        iframeWithEmptySrc.parentNode.removeChild(iframeWithEmptySrc);
        iframeAboutBlank.parentNode.removeChild(iframeAboutBlank);

        start();
    });
});

test('isDomElement', function () {
    ok(DOM.isDomElement(document.body));
    ok(DOM.isDomElement(document.createElement('span')));
    ok(DOM.isDomElement(document.createElement('strong')));
    ok(DOM.isDomElement(document.createElement('a')));
    ok(!DOM.isDomElement(null));

    //T184805
    var p = Element.prototype;

    /* eslint-disable no-extra-parens */
    do {
        ok(!DOM.isDomElement(p));
    } while ((p = Object.getPrototypeOf(p)));
    /* eslint-enable no-extra-parens */
});

asyncTest('isDomElement for iframe Element.prototype chain', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test4';
    iframe.src = '';
    iframe.addEventListener('load', function () {
        var p = this.contentWindow.Element.prototype;

        /* eslint-disable no-extra-parens */
        do {
            ok(!DOM.isDomElement(p));
        } while ((p = Object.getPrototypeOf(p)));
        /* eslint-enable no-extra-parens */

        this.parentNode.removeChild(this);
        start();
    });

    document.body.appendChild(iframe);
});

//B252941 - TestCafe - act.click throws an error in FF when click on <object> tag
test('IsDomElement for <object> tag', function () {
    var objectElement = document.createElement('object');

    document.body.appendChild(objectElement);

    ok(DOM.isDomElement(objectElement));

    objectElement.parentNode.removeChild(objectElement);
});

asyncTest('getTopSameDomainWindow', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test5';
    iframe.addEventListener('load', function () {
        strictEqual(DOM.getTopSameDomainWindow(window.top), window.top);
        strictEqual(DOM.getTopSameDomainWindow(this.contentWindow), window.top);

        iframe.parentNode.removeChild(iframe);
        start();
    });
    document.body.appendChild(iframe);
});

test('isWindowInstance', function () {
    ok(DOM.isWindowInstance(window));
    ok(!DOM.isWindowInstance({ top: '' }));

    var storedToString = window.toString;

    window.toString = function () {
        throw 'eid library overrides window.toString() method';
    };

    ok(DOM.isWindowInstance(window));

    window.toString = storedToString;
});

test('closest element', function () {
    var div = document.createElement('div');

    div.className = 'parent';
    div           = document.body.appendChild(div);

    var innerDiv = document.createElement('div');

    innerDiv.className = 'child';
    div.appendChild(innerDiv);

    ok(!DOM.closest(null, '.test'));
    strictEqual(DOM.closest(innerDiv, '.parent'), div);
    strictEqual(DOM.closest(div, 'html'), document.documentElement);

    var iframe = document.createElement('iframe');

    iframe.id = 'test5';
    iframe    = document.body.appendChild(iframe);

    var iframeDiv = iframe.contentDocument.createElement('div');

    iframeDiv.className = 'parent';

    //IE9, IE10
    if (!iframe.contentDocument.body) {
        var body = iframe.contentDocument.createElement('body');

        iframe.contentDocument.appendChild(body);
    }

    iframeDiv = iframe.contentDocument.body.appendChild(iframeDiv);

    var innerIframeDiv = iframe.contentDocument.createElement('div');

    innerIframeDiv.className = 'child';
    iframeDiv.appendChild(innerIframeDiv);

    strictEqual(DOM.closest(innerIframeDiv, '.parent'), iframeDiv);
    strictEqual(DOM.closest(iframeDiv, 'body'), iframe.contentDocument.body);

    iframe.parentNode.removeChild(iframe);
    div.parentNode.removeChild(div);
});

module('isIframeWithoutSrc');

asyncTest('changed location 2', function () {
    var handler = function () {
        this.removeEventListener('load', handler);
        this.addEventListener('load', function () {
            this[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = window;
            ok(!UrlUtil.isIframeWithoutSrc(this));
            ok(!DOM.isCrossDomainIframe(this));
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
    iframe.src = 'http://' + location.hostname + ':1336/hammerhead/simple_page.html';
    iframe.addEventListener('load', function () {
        this[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = window;
        ok(!UrlUtil.isIframeWithoutSrc(this));
        ok(DOM.isCrossDomainIframe(this));
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
        this[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = window;
        ok(!UrlUtil.isIframeWithoutSrc(this));
        ok(!DOM.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);

        start();
    });
    document.body.appendChild(iframe);
});

asyncTest('without src attribute', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test10';
    iframe.addEventListener('load', function () {
        this[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = window;
        ok(UrlUtil.isIframeWithoutSrc(this));
        ok(!DOM.isCrossDomainIframe(this));
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
        this[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = window;
        ok(UrlUtil.isIframeWithoutSrc(this));
        ok(!DOM.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);
        start();
    });
    document.body.appendChild(iframe);
});

module('isCrossDomainIFrame');

asyncTest('location is changed to cross-domain', function () {
    expect(4);

    var iteration = 0;
    var iframe    = document.createElement('iframe');

    iframe.id  = 'test12';
    iframe.src = 'http://' + location.host + '/';
    iframe.addEventListener('load', function () {
        if (!iteration) {
            ok(!DOM.isCrossDomainIframe(this));
            ok(!DOM.isCrossDomainIframe(this, true));

            this.contentDocument.location.href = 'http://' + location.hostname + ':1336/hammerhead/simple_page.html';
            iteration++;
        }
        else {
            ok(DOM.isCrossDomainIframe(this));
            ok(!DOM.isCrossDomainIframe(this, true));
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
        this[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = window;
        ok(UrlUtil.isIframeWithoutSrc(this));
        ok(!DOM.isCrossDomainIframe(this));
        this.parentNode.removeChild(this);
        start();
    });
    document.body.appendChild(iframe);
});

module('class manipulation');

test('addClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    DOM.addClass(null, 'test');
    strictEqual(div.className, '');

    DOM.addClass(div, 'test');
    strictEqual(div.className, 'test');

    div.className = 'test1';
    DOM.addClass(div, 'test2 test3');
    strictEqual(div.className, 'test1 test2 test3');

    div.className = 'test1 test2';
    DOM.addClass(div, 'test2 test3');
    strictEqual(div.className, 'test1 test2 test3');

    div.parentNode.removeChild(div);
});

test('removeClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    DOM.removeClass(null, 'test');
    DOM.removeClass(div, 'test');
    strictEqual(div.className, '');

    div.className = 'test';
    DOM.removeClass(div, 'test');
    strictEqual(div.className, '');

    div.className = 'test1 test2 test3';
    DOM.removeClass(div, 'test1');
    strictEqual(div.className, 'test2 test3');

    div.className = 'test1 test2 test3';
    DOM.removeClass(div, 'test2');
    strictEqual(div.className, 'test1 test3');

    div.className = 'test1 test2 test3';
    DOM.removeClass(div, 'test3');
    strictEqual(div.className, 'test1 test2');

    div.className = 'test1 test2 test3';
    DOM.removeClass(div, 'test1 test3');
    strictEqual(div.className, 'test2');

    div.parentNode.removeChild(div);
});

test('hasClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    ok(!DOM.hasClass(null, 'test'));

    div.className = 'test';
    ok(DOM.hasClass(div, 'test'));

    div.className = 'test1 test2 test3';
    ok(DOM.hasClass(div, 'test1'));
    ok(DOM.hasClass(div, 'test2'));
    ok(DOM.hasClass(div, 'test3'));

    div.parentNode.removeChild(div);
});
