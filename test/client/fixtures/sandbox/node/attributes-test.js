var INTERNAL_PROPS   = hammerhead.get('../processing/dom/internal-properties');
var domProcessor     = hammerhead.get('./dom-processor');
var htmlUtils        = hammerhead.get('./utils/html');
var settings         = hammerhead.get('./settings');
var urlUtils         = hammerhead.get('./utils/url');
var destLocation     = hammerhead.get('./utils/destination-location');
var featureDetection = hammerhead.get('./utils/feature-detection');

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var iframeSandbox = hammerhead.sandbox.iframe;
var unloadSandbox = hammerhead.sandbox.event.unload;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

test('url', function () {
    window.name = 'urlTest';

    var testUrlAttr = function (tagName, attr, target) {
        var el         = nativeMethods.createElement.call(document, tagName);
        var storedAttr = domProcessor.getStoredAttrName(attr);
        var namespace  = 'http://www.w3.org/1999/xhtml';

        var getAttr = function () {
            return nativeMethods.getAttribute.call(el, attr);
        };

        var getWrapAttr = function () {
            return nativeMethods.getAttribute.call(el, storedAttr);
        };

        processDomMeth(el);

        el.setAttribute(attr, '');

        var emptyAttrValue = el[attr];
        var dest           = 'http://dest.com/';
        var resourceType   = null;

        if (tagName === 'script')
            resourceType = 's';
        else if (tagName === 'form')
            resourceType = 'f';

        var proxy = urlUtils.getProxyUrl(dest, { resourceType: resourceType, target: target });

        setProperty(el, attr, dest);
        strictEqual(el[attr], proxy);
        strictEqual(getProperty(el, attr), dest);
        strictEqual(getAttr(), proxy);
        strictEqual(getWrapAttr(), dest);

        var newUrl      = '/image';
        var proxyNewUrl = urlUtils.getProxyUrl('/image', { resourceType: resourceType, target: target });

        el.setAttribute(attr, newUrl);
        strictEqual(el[attr], proxyNewUrl);
        strictEqual(getProperty(el, attr), urlUtils.parseProxyUrl(proxyNewUrl).destUrl);
        strictEqual(getAttr(), proxyNewUrl);
        strictEqual(getWrapAttr(), newUrl);

        setProperty(el, attr, '');
        strictEqual(getWrapAttr(), '');
        strictEqual(getAttr(), '');
        strictEqual(el[attr], emptyAttrValue);
        strictEqual(getProperty(el, attr), destLocation.get());

        el.removeAttribute(attr);
        strictEqual(getWrapAttr(), null);
        strictEqual(getAttr(), null);

        if (attr === 'action' && featureDetection.emptyActionAttrFallbacksToTheLocation)
            strictEqual(getProperty(el, attr), destLocation.get());
        else
            strictEqual(getProperty(el, attr), '');

        el.setAttributeNS(namespace, attr, dest);
        strictEqual(nativeMethods.getAttributeNS.call(el, namespace, attr), proxy);
        strictEqual(nativeMethods.getAttributeNS.call(el, namespace, storedAttr), dest);
    };

    var testData = [
        { tagName: 'a', attr: 'href', target: window.name },
        { tagName: 'script', attr: 'src' },
        { tagName: 'link', attr: 'href' },
        { tagName: 'form', attr: 'action', target: window.name },
        { tagName: 'embed', attr: 'src' },
        { tagName: 'object', attr: 'data' }
    ];

    for (var i = 0; i < testData.length; i++)
        testUrlAttr(testData[i].tagName, testData[i].attr, testData[i].target);
});

test('script src', function () {
    var storedSessionId = settings.get().sessionId;

    settings.get().sessionId = 'sessionId';

    var script = document.createElement('script');

    processDomMeth(script);

    document[INTERNAL_PROPS.documentCharset] = 'utf-8';

    script.setAttribute('src', 'http://google.com');

    strictEqual(urlUtils.parseProxyUrl(script.src).resourceType, 's');
    strictEqual(urlUtils.parseProxyUrl(script.src).charset, 'utf-8');

    document[INTERNAL_PROPS.documentCharset] = null;

    settings.get().sessionId = storedSessionId;
});

asyncTest('iframe with "javascript: <html>...</html>" src', function () {
    var iframe = document.createElement('iframe');
    var src    = 'javascript:"<script>var d = {}; d.src = 1; window.test = true;<\/script>"';

    iframe.id = 'test55';
    processDomMeth(iframe);

    iframe.setAttribute('src', src);

    iframe.onload = function () {
        if (this.contentWindow.test) {
            ok(this.contentWindow.test);
            document.body.removeChild(this);

            start();
        }
    };

    document.body.appendChild(iframe);
});

asyncTest('iframe html src', function () {
    var iframe = document.createElement('iframe');
    var src    = 'javascript:\'<html><body><a id=\\\'test\\\' data-attr=\"123\">link</a></body></html>\'';

    iframe.id = 'test56';
    processDomMeth(iframe);

    iframe.setAttribute('src', src);

    var srcAttr       = nativeMethods.getAttribute.call(iframe, 'src');
    var storedSrcAttr = nativeMethods.getAttribute.call(iframe, domProcessor.getStoredAttrName('src'));

    notEqual(srcAttr, src);
    strictEqual(srcAttr, 'javascript:\'' +
                         htmlUtils.processHtml('<html><body><a id=\'test\' data-attr=\"123\">link</a></body></html>') +
                         '\'');
    strictEqual(storedSrcAttr, src);
    strictEqual(iframe.getAttribute('src'), src);

    iframe.onload = function () {
        if (this.contentDocument.getElementById('test')) {
            ok(this.contentDocument.getElementById('test'));
            strictEqual(this.contentDocument.getElementById('test').getAttribute('data-attr'), '123');
            document.body.removeChild(this);

            start();
        }
    };

    document.body.appendChild(iframe);
});

test('iframe javascript src', function () {
    var testData = [
        {
            src: "<img src=\\'http://google.com\\'/>" +
                 "<div attr1=\"\\'\\'\" attr2=\\'\"\"\\'></div>",

            expected: ["<div attr1=\"\\'\\'\" attr2=\"&quot;&quot;\"></div>",
                "<div attr2=\\'\"\"\\' attr1=\"\\'\\'\"></div>"
            ],

            quote: '\''
        },
        {
            src: "<img src='http://google.com'/>" +
                 "<div attr1=\\\"''\\\" attr2='\\\"\\\"'></div>",

            expected: ["<div attr1=\\\"''\\\" attr2=\\\"&quot;&quot;\\\"></div>",
                "<div attr2='\\\"\\\"' attr1=\\\"''\\\"></div>"
            ],

            quote: '"'
        },
        {
            src: "<script> t[i] = \\'\\\\'\\\\'\\'; j = \"\\\"\\\"\"; <\/script>",

            expected: ["__set$(t,i,\\'\\\\'\\\\'\\');j=\"\\\"\\\"\""],

            quote: '\''
        },
        {
            src: "<script> t[i] = \'\\\'\\\'\'; j = \\\"\\\\\"\\\\\"\\\"; <\/script>",

            expected: ["__set$(t,i,'\\\'\\\'');j=\\\"\\\\\"\\\\\"\\\";"],

            quote: '"'
        }
    ];

    var testContainer = document.createElement('iframe');

    for (var i = 0; i < testData.length; i++) {
        var src = testData[i].src;

        src = 'javascript:' + testData[i].quote + src + testData[i].quote;

        testContainer.setAttribute('src', src);

        var processedSrc = testContainer.src;

        // NOTE: Safari returns an encoded value for iframe.src with a javascript protocol value.
        if (browserUtils.isSafari) {
            processedSrc = processedSrc.replace(/%hammerhead%/g, '%25hammerhead%25');
            processedSrc = decodeURI(processedSrc);
        }

        strictEqual(processedSrc.indexOf('javascript:' + testData[i].quote), 0);
        strictEqual(processedSrc[processedSrc.length - 1], testData[i].quote);

        processedSrc = processedSrc.replace(/%hammerhead%/g, '%25hammerhead%25');

        var decodedSrc = decodeURIComponent(processedSrc);
        var expected   = testData[i].expected;

        ok(decodedSrc.indexOf(expected[0]) !== -1 || decodedSrc.indexOf(expected[1]) !== -1);
    }
});

test('target', function () {
    var tagNames = ['a', 'form', 'area', 'base'];
    var tag      = null;

    for (var i = 0; i < tagNames.length; i++) {
        tag = document.createElement(tagNames[i]);

        tag.setAttribute('target', '_blank');
        ok(!tag.getAttribute('target'));

        tag.setAttribute('target', '_self');
        ok(tag.getAttribute('target'));

        setProperty(tag, 'target', '_blank');
        ok(tag.target !== '_blank');
    }
});

test('onclick', function () {
    var link      = document.createElement('a');
    var attrValue = 'location.href="managers.aspx";';

    link.setAttribute('onclick', attrValue);

    var attr       = nativeMethods.getAttribute.call(link, 'onclick');
    var storedAttr = nativeMethods.getAttribute.call(link, domProcessor.getStoredAttrName('onclick'));

    notEqual(attr, storedAttr);
    strictEqual(storedAttr, attrValue);
    strictEqual(attr, processScript(attrValue));
    strictEqual(link.getAttribute('onclick'), attrValue);
});

test('event - javascript protocol', function () {
    var link      = document.createElement('a');
    var attrValue = 'javascript:location.href="managers.aspx";';

    link.setAttribute('onclick', attrValue);

    var attr       = nativeMethods.getAttribute.call(link, 'onclick');
    var storedAttr = nativeMethods.getAttribute.call(link, domProcessor.getStoredAttrName('onclick'));

    notEqual(attr, storedAttr);
    strictEqual(storedAttr, attrValue);
    strictEqual(attr, 'javascript:' + processScript(attrValue.replace('javascript:', '')));
    strictEqual(link.getAttribute('onclick'), attrValue);
});

test('url - javascript: protocol', function () {
    var link      = document.createElement('a');
    var hrefValue = 'javascript:location.href="managers.aspx?Delete=814";';

    link.setAttribute('href', hrefValue);

    var href       = nativeMethods.getAttribute.call(link, 'href');
    var storedHref = nativeMethods.getAttribute.call(link, domProcessor.getStoredAttrName('href'));

    notEqual(href, storedHref);
    strictEqual(storedHref, hrefValue);
    strictEqual(href, 'javascript:' + processScript(hrefValue.replace('javascript:', '')));
    strictEqual(link.getAttribute('href'), hrefValue);
});

test('iframe', function () {
    var attr       = 'sandbox';
    var storedAttr = domProcessor.getStoredAttrName(attr);
    var iframe     = document.createElement('iframe');

    ok(!nativeMethods.getAttribute.call(iframe, attr));
    ok(!nativeMethods.getAttribute.call(iframe, storedAttr));
    ok(!iframe.getAttribute(attr));

    iframe.setAttribute(attr, 'allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, attr), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts');
    strictEqual(iframe.getAttribute(attr), 'allow-scripts');

    iframe.setAttribute(attr, 'allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, attr), 'allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-same-origin');
    strictEqual(iframe.getAttribute(attr), 'allow-same-origin');

    iframe.setAttribute(attr, 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, attr), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts allow-same-origin');
    strictEqual(iframe.getAttribute(attr), 'allow-scripts allow-same-origin');

    iframe.setAttribute(attr, 'allow-same-origin allow-forms');
    strictEqual(nativeMethods.getAttribute.call(iframe, attr), 'allow-same-origin allow-forms allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-same-origin allow-forms');
    strictEqual(iframe.getAttribute(attr), 'allow-same-origin allow-forms');

    iframe.setAttribute(attr, 'allow-scripts allow-forms');
    strictEqual(nativeMethods.getAttribute.call(iframe, attr), 'allow-scripts allow-forms allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts allow-forms');
    strictEqual(iframe.getAttribute(attr), 'allow-scripts allow-forms');

    iframe.setAttribute(attr, 'allow-scripts allow-forms allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, attr), 'allow-scripts allow-forms allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts allow-forms allow-same-origin');
    strictEqual(iframe.getAttribute(attr), 'allow-scripts allow-forms allow-same-origin');

    iframe.setAttribute(attr, 'allow-forms');
    strictEqual(nativeMethods.getAttribute.call(iframe, attr), 'allow-forms allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-forms');
    strictEqual(iframe.getAttribute(attr), 'allow-forms');
});

test('crossdomain iframe', function () {
    var iframe        = document.createElement('iframe');
    var storedSrcAttr = domProcessor.getStoredAttrName('src');

    var savedGetProxyUrl                  = urlUtils.getProxyUrl;
    var savedGetCrossDomainIframeProxyUrl = urlUtils.getCrossDomainIframeProxyUrl;

    var crossDomainUrl      = 'http://cross.domain.com/';
    var crossDomainProxyUrl = 'http://proxy.cross.domain.com/';
    var proxyUrl            = 'http://proxy.com/';


    urlUtils.getProxyUrl = function () {
        return proxyUrl;
    };

    urlUtils.getCrossDomainIframeProxyUrl = function () {
        return crossDomainProxyUrl;
    };

    setProperty(iframe, 'src', crossDomainUrl);
    strictEqual(iframe.src, crossDomainProxyUrl);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'src'), crossDomainProxyUrl);
    strictEqual(nativeMethods.getAttribute.call(iframe, storedSrcAttr), crossDomainUrl);

    setProperty(iframe, 'src', location.toString() + '?param');
    strictEqual(iframe.src, proxyUrl);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'src'), proxyUrl);
    strictEqual(iframe.getAttribute('src'), location.toString() + '?param');

    urlUtils.getProxyUrl                  = savedGetProxyUrl;
    urlUtils.getCrossDomainIframeProxyUrl = savedGetCrossDomainIframeProxyUrl;
});

test('input.autocomplete', function () {
    var input      = document.createElement('input');
    var etalon     = nativeMethods.createElement.call(document, 'input');
    var storedAttr = domProcessor.getStoredAttrName('autocomplete');

    strictEqual(input.getAttribute('autocomplete'), nativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input, storedAttr), 'none');

    input.setAttribute('autocomplete', 'off');
    nativeMethods.setAttribute.call(etalon, 'autocomplete', 'off');
    strictEqual(input.getAttribute('autocomplete'), nativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input, storedAttr), 'off');

    input.setAttribute('autocomplete', 'on');
    nativeMethods.setAttribute.call(etalon, 'autocomplete', 'on');
    strictEqual(input.getAttribute('autocomplete'), nativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input, storedAttr), 'on');

    input.setAttribute('autocomplete', '');
    nativeMethods.setAttribute.call(etalon, 'autocomplete', '');
    strictEqual(input.getAttribute('autocomplete'), nativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input, storedAttr), '');

    input.removeAttribute('autocomplete');
    nativeMethods.removeAttribute.call(etalon, 'autocomplete');
    strictEqual(input.getAttribute('autocomplete'), nativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(nativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input, storedAttr), 'none');
});

test('window.onbeforeunload', function () {
    var evName = 'on' + unloadSandbox.beforeUnloadEventName;

    strictEqual(window[evName], null);
    // NOTE: If this test fails, a system dialog blocks the page before it is unloaded.
    setProperty(window, evName, function () {
        return 'value';
    });
    ok(window[evName]);
});

test('element.innerHTML', function () {
    settings.get().sessionId = 'sessionId';

    var $container   = $('<div>');
    var checkElement = function (el, attr, resourceType, target) {
        var storedAttr     = domProcessor.getStoredAttrName(attr);
        var exprectedValue = urlUtils.getProxyUrl('https://example.com/Images/1.png', {
            target:       target,
            resourceType: resourceType
        });

        strictEqual(nativeMethods.getAttribute.call(el, storedAttr), '/Images/1.png', 'destination url stored');
        strictEqual(nativeMethods.getAttribute.call(el, attr), exprectedValue);
    };

    var html = ' <A iD = " fakeId1 " hRef = "/Images/1.png" attr="test" ></A>' +
               ' <form iD="fakeId3 " action="/Images/1.png"    attr="test" ></form>' +
               ' <link  iD = " fakeId5" href="/Images/1.png" attr="test" ></link>' +
               ' <' + 'script  iD = "  fakeId6  " sRc=  "/Images/1.png" attr= "test"' + '>' + '</' + 'scriPt' + '>';

    setProperty($container[0], 'innerHTML', html);

    checkElement($container.find('a')[0], 'href', '', window.name);
    checkElement($container.find('form')[0], 'action', 'f', window.name);
    checkElement($container.find('link')[0], 'href', '', window.name);
    checkElement($container.find('script')[0], 'src', 's', window.name);
});

test('anchor with target attribute', function () {
    var anchor   = document.createElement('a');
    var url      = 'http://url.com/';
    var iframe   = document.createElement('iframe');
    var proxyUrl = urlUtils.getProxyUrl(url, { resourceType: 'i', target: 'iframeName' });

    iframe.id   = 'test_unique_id_e16w9jnv5';
    iframe.name = 'iframeName';
    document.body.appendChild(iframe);

    anchor.setAttribute('target', 'iframeName');

    strictEqual(nativeMethods.getAttribute.call(anchor, 'target'), 'iframeName');

    anchor.setAttribute('href', url);

    var nativeHref = nativeMethods.getAttribute.call(anchor, 'href');

    strictEqual(nativeHref, proxyUrl);
    strictEqual(nativeMethods.getAttribute.call(anchor, domProcessor.getStoredAttrName('href')), url);
    strictEqual(anchor.getAttribute('href'), url);
    strictEqual(urlUtils.parseProxyUrl(nativeHref).resourceType, 'i');

    iframe.parentNode.removeChild(iframe);
});

test('case insensitive target="_blank"', function () {
    var link = document.createElement('a');

    link.setAttribute('target', '_Blank');
    ok(!link.getAttribute('target'));
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

    iframe.id   = 'test_unique_id_ispt7enuo';
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

test('setting function to the link.href attribute value (T230764)', function () {
    var a     = document.createElement('a');
    var error = false;

    try {
        a.setAttribute('href', function () { /* */
        });
    }
    catch (e) {
        error = true;
    }
    finally {
        ok(!error);
    }
});
