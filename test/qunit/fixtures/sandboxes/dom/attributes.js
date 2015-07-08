var DomProcessor  = Hammerhead.get('./dom-processor/dom-processor');
var Html          = Hammerhead.get('./util/html');
var IFrameSandbox = Hammerhead.get('./sandboxes/iframe');
var NativeMethods = Hammerhead.get('./sandboxes/native-methods');
var Settings      = Hammerhead.get('./settings');
var UrlUtil       = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    // 'window.open' method uses in the QUnit
    window.open       = NativeMethods.windowOpen;
    window.setTimeout = NativeMethods.setTimeout;
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

test('url', function () {
    var testUrlAttr = function (tagName, attr) {
        var el         = NativeMethods.createElement.call(document, tagName);
        var storedAttr = DomProcessor.getStoredAttrName(attr);
        var namespace  = 'http://www.w3.org/1999/xhtml';

        var getAttr = function () {
            return NativeMethods.getAttribute.call(el, attr);
        };

        var getWrapAttr = function () {
            return NativeMethods.getAttribute.call(el, storedAttr);
        };

        overrideDomMeth(el);

        el.setAttribute(attr, '');

        var emptyAttrValue = el[attr];
        var origin         = 'http://origin.com/';
        var resourceType   = tagName === 'script' ? 'script' : null;
        var proxy          = UrlUtil.getProxyUrl(origin, null, null, null, null, resourceType);

        setProperty(el, attr, origin);
        strictEqual(el[attr], proxy);
        strictEqual(getProperty(el, attr), origin);
        strictEqual(getAttr(), proxy);
        strictEqual(getWrapAttr(), origin);

        var newUrl      = '/image';
        var proxyNewUrl = UrlUtil.getProxyUrl('/image', null, null, null, null, resourceType);

        el.setAttribute(attr, newUrl);
        strictEqual(el[attr], proxyNewUrl);
        strictEqual(getProperty(el, attr), UrlUtil.parseProxyUrl(proxyNewUrl).originUrl);
        strictEqual(getAttr(), proxyNewUrl);
        strictEqual(getWrapAttr(), newUrl);

        setProperty(el, attr, '');
        strictEqual(getWrapAttr(), '');
        strictEqual(getAttr(), '');
        strictEqual(el[attr], emptyAttrValue);

        el.removeAttribute(attr);
        strictEqual(getWrapAttr(), null);
        strictEqual(getAttr(), null);
        strictEqual(el[attr], '');

        el.setAttributeNS(namespace, attr, origin);
        strictEqual(NativeMethods.getAttributeNS.call(el, namespace, attr), proxy);
        strictEqual(NativeMethods.getAttributeNS.call(el, namespace, storedAttr), origin);
    };

    var testData = [
        { tagName: 'a', attr: 'href' },
        { tagName: 'script', attr: 'src' },
        { tagName: 'link', attr: 'href' },
        { tagName: 'form', attr: 'action' },
        { tagName: 'embed', attr: 'src' },
        { tagName: 'object', attr: 'data' }
    ];

    for (var i = 0; i < testData.length; i++)
        testUrlAttr(testData[i].tagName, testData[i].attr);
});

test('script src', function () {
    var storedJobUid     = Settings.get().JOB_UID;
    var storedOwnerToken = Settings.get().JOB_OWNER_TOKEN;

    Settings.get().JOB_UID         = 'uid';
    Settings.get().JOB_OWNER_TOKEN = 'token';

    var script = document.createElement('script');

    overrideDomMeth(script);

    script.setAttribute('src', 'http://google.com');

    strictEqual(UrlUtil.parseProxyUrl(script.src).resourceType, UrlUtil.SCRIPT);

    Settings.get().JOB_UID         = storedJobUid;
    Settings.get().JOB_OWNER_TOKEN = storedOwnerToken;
});

asyncTest('iframe with "javascript: <html>...</html>" src', function () {
    var iframe = document.createElement('iframe');
    var src    = 'javascript:"<script>var d = {}; d.src = 1; window.test = true;<\/script>"';

    iframe.id = 'test55';
    overrideDomMeth(iframe);

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
    overrideDomMeth(iframe);

    iframe.setAttribute('src', src);

    var srcAttr       = NativeMethods.getAttribute.call(iframe, 'src');
    var storedSrcAttr = NativeMethods.getAttribute.call(iframe, DomProcessor.getStoredAttrName('src'));

    notEqual(srcAttr, src);
    strictEqual(srcAttr, 'javascript:\'' +
                         Html.processHtml('<html><body><a id=\'test\' data-attr=\"123\">link</a></body></html>') +
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

        strictEqual(processedSrc.indexOf('javascript:' + testData[i].quote), 0);
        strictEqual(processedSrc[processedSrc.length - 1], testData[i].quote);

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

    var attr       = NativeMethods.getAttribute.call(link, 'onclick');
    var storedAttr = NativeMethods.getAttribute.call(link, DomProcessor.getStoredAttrName('onclick'));

    notEqual(attr, storedAttr);
    strictEqual(storedAttr, attrValue);
    strictEqual(attr, processScript(attrValue));
    strictEqual(link.getAttribute('onclick'), attrValue);
});

test('event - javascript protocol', function () {
    var link      = document.createElement('a');
    var attrValue = 'javascript:location.href="managers.aspx";';

    link.setAttribute('onclick', attrValue);

    var attr       = NativeMethods.getAttribute.call(link, 'onclick');
    var storedAttr = NativeMethods.getAttribute.call(link, DomProcessor.getStoredAttrName('onclick'));

    notEqual(attr, storedAttr);
    strictEqual(storedAttr, attrValue);
    strictEqual(attr, 'javascript:' + processScript(attrValue.replace('javascript:', '')));
    strictEqual(link.getAttribute('onclick'), attrValue);
});

test('url - javascript: protocol', function () {
    var link      = document.createElement('a');
    var hrefValue = 'javascript:location.href="managers.aspx?Delete=814";';

    link.setAttribute('href', hrefValue);

    var href       = NativeMethods.getAttribute.call(link, 'href');
    var storedHref = NativeMethods.getAttribute.call(link, DomProcessor.getStoredAttrName('href'));

    notEqual(href, storedHref);
    strictEqual(storedHref, hrefValue);
    strictEqual(href, 'javascript:' + processScript(hrefValue.replace('javascript:', '')));
    strictEqual(link.getAttribute('href'), hrefValue);
});

test('iframe', function () {
    var attr       = 'sandbox';
    var storedAttr = DomProcessor.getStoredAttrName(attr);
    var iframe     = document.createElement('iframe');

    overrideDomMeth(iframe);

    ok(!NativeMethods.getAttribute.call(iframe, attr));
    ok(!NativeMethods.getAttribute.call(iframe, storedAttr));
    ok(!iframe.getAttribute(attr));

    iframe.setAttribute(attr, 'allow-scripts allow-forms');
    strictEqual(NativeMethods.getAttribute.call(iframe, attr), 'allow-scripts allow-forms');
    ok(!NativeMethods.getAttribute.call(iframe, storedAttr));
    strictEqual(iframe.getAttribute(attr), 'allow-scripts allow-forms');

    iframe.setAttribute(attr, 'allow-forms');
    strictEqual(NativeMethods.getAttribute.call(iframe, attr), 'allow-forms allow-scripts');
    strictEqual(NativeMethods.getAttribute.call(iframe, storedAttr), 'allow-forms');
    strictEqual(iframe.getAttribute(attr), 'allow-forms');
});

test('crossdomain iframe', function () {
    var iframe        = document.createElement('iframe');
    var storedSrcAttr = DomProcessor.getStoredAttrName('src');

    var savedGetProxyUrl                  = UrlUtil.getProxyUrl;
    var savedGetCrossDomainIframeProxyUrl = UrlUtil.getCrossDomainIframeProxyUrl;

    var crossDomainUrl      = 'http://cross.domain.com/';
    var crossDomainProxyUrl = 'http://proxy.cross.domain.com/';
    var proxyUrl            = 'http://proxy.com/';


    UrlUtil.getProxyUrl = function () {
        return proxyUrl;
    };

    UrlUtil.getCrossDomainIframeProxyUrl = function () {
        return crossDomainProxyUrl;
    };

    setProperty(iframe, 'src', crossDomainUrl);
    strictEqual(iframe.src, crossDomainProxyUrl);
    strictEqual(NativeMethods.getAttribute.call(iframe, 'src'), crossDomainProxyUrl);
    strictEqual(NativeMethods.getAttribute.call(iframe, storedSrcAttr), crossDomainUrl);

    setProperty(iframe, 'src', location.toString() + '?param');
    strictEqual(iframe.src, proxyUrl);
    strictEqual(NativeMethods.getAttribute.call(iframe, 'src'), proxyUrl);
    strictEqual(iframe.getAttribute('src'), location.toString() + '?param');

    UrlUtil.getProxyUrl                  = savedGetProxyUrl;
    UrlUtil.getCrossDomainIframeProxyUrl = savedGetCrossDomainIframeProxyUrl;
});

test('input.autocomplete', function () {
    var input      = document.createElement('input');
    var etalon     = NativeMethods.createElement.call(document, 'input');
    var storedAttr = DomProcessor.getStoredAttrName('autocomplete');

    strictEqual(input.getAttribute('autocomplete'), NativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input, storedAttr), 'none');

    input.setAttribute('autocomplete', 'off');
    NativeMethods.setAttribute.call(etalon, 'autocomplete', 'off');
    strictEqual(input.getAttribute('autocomplete'), NativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input, storedAttr), 'off');

    input.setAttribute('autocomplete', 'on');
    NativeMethods.setAttribute.call(etalon, 'autocomplete', 'on');
    strictEqual(input.getAttribute('autocomplete'), NativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input, storedAttr), 'on');

    input.setAttribute('autocomplete', '');
    NativeMethods.setAttribute.call(etalon, 'autocomplete', '');
    strictEqual(input.getAttribute('autocomplete'), NativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input, storedAttr), '');

    input.removeAttribute('autocomplete');
    NativeMethods.removeAttribute.call(etalon, 'autocomplete');
    strictEqual(input.getAttribute('autocomplete'), NativeMethods.getAttribute.call(etalon, 'autocomplete'));
    strictEqual(NativeMethods.getAttribute.call(input, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input, storedAttr), 'none');
});

test('window.onbeforeunload', function () {
    strictEqual(window.onbeforeunload, null);
    //NOTE: if the test will be failed, system dialog blocks page before the page unloading
    setProperty(window, 'onbeforeunload', function () {
        return 'value';
    });
    ok(window.onbeforeunload);
});

test('element.innerHTML', function () {
    Settings.get().JOB_UID         = 'job';
    Settings.get().JOB_OWNER_TOKEN = 'token';

    var $container   = $('<div>');
    var checkElement = function (el, attr, resourceType) {
        var storedAttr     = DomProcessor.getStoredAttrName(attr);
        var exprectedValue = 'http://' + location.host + '/token!job' + resourceType +
                             '/https://example.com/Images/1.png';

        strictEqual(NativeMethods.getAttribute.call(el, storedAttr), '/Images/1.png', 'original url stored');
        strictEqual(NativeMethods.getAttribute.call(el, attr), exprectedValue);
    };

    var html = ' <A iD = " fakeId1 " hRef = "/Images/1.png" attr="test" ></A>' +
               ' <form iD="fakeId3 " action="/Images/1.png"    attr="test" ></form>' +
               ' <link  iD = " fakeId5" href="/Images/1.png" attr="test" ></link>' +
               ' <' + 'script  iD = "  fakeId6  " sRc=  "/Images/1.png" attr= "test"' + '>' + '</' + 'scriPt' + '>';

    setProperty($container[0], 'innerHTML', html);

    checkElement($container.find('a')[0], 'href', '');
    checkElement($container.find('form')[0], 'action', '');
    checkElement($container.find('link')[0], 'href', '');
    checkElement($container.find('script')[0], 'src', UrlUtil.REQUEST_DESCRIPTOR_VALUES_SEPARATOR + 'script');
});

test('anchor with target attribute', function () {
    var anchor   = document.createElement('a');
    var url      = 'http://url.com/';
    var proxyUrl = UrlUtil.getProxyUrl(url, null, null, null, null, 'iframe');

    anchor.setAttribute('target', 'iframeName');

    strictEqual(NativeMethods.getAttribute.call(anchor, 'target'), 'iframeName');

    anchor.setAttribute('href', url);

    var nativeHref = NativeMethods.getAttribute.call(anchor, 'href');

    strictEqual(nativeHref, proxyUrl);
    strictEqual(NativeMethods.getAttribute.call(anchor, DomProcessor.getStoredAttrName('href')), url);
    strictEqual(anchor.getAttribute('href'), url);
    strictEqual(UrlUtil.parseProxyUrl(nativeHref).resourceType, 'iframe');
});

//T230764: TD15.1 - Firefox - value.replace is not a function, js errors on lastfm.ru
test('setAttribute as function', function () {
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

//B239854 - Google Images - reload page after first mouse click on image
asyncTest('form.submit', function () {
    var form = document.createElement('form');
    var url  = 'http://example.com';

    expect(2);

    notEqual(form.submit, NativeMethods.formSubmit);

    form.action = url + '/?key=value';

    form.addEventListener('submit', function (event) {
        strictEqual(this['key'], this[this.length - 1]);
        event.preventDefault();
        start();
    }, false);

    var ev = document.createEvent('Events');

    ev.initEvent('submit', true, true);
    form.dispatchEvent(ev);
});
