var INTERNAL_PROPS   = hammerhead.get('../processing/dom/internal-properties');
var domProcessor     = hammerhead.get('./dom-processor');
var htmlUtils        = hammerhead.get('./utils/html');
var settings         = hammerhead.get('./settings');
var urlUtils         = hammerhead.get('./utils/url');
var destLocation     = hammerhead.get('./utils/destination-location');
var featureDetection = hammerhead.get('./utils/feature-detection');
var processScript    = hammerhead.get('../processing/script').processScript;

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var unloadSandbox = hammerhead.sandbox.event.unload;

// NOTE: IE11 has a strange bug that does not allow this test to pass
if (!browserUtils.isIE || browserUtils.version !== 11) {
    test('onsubmit', function () {
        var etalon = nativeMethods.createElement.call(document, 'form');
        var form   = document.createElement('form');

        var check = function () {
            strictEqual(form.getAttribute('onsubmit'), nativeMethods.getAttribute.call(etalon, 'onsubmit'));

            var onsubmit = getProperty(form, 'onsubmit');

            strictEqual(onsubmit ? onsubmit() : onsubmit, etalon.onsubmit ? etalon.onsubmit() : etalon.onsubmit);
        };

        check();

        form.setAttribute('onsubmit', 'return 1;');
        nativeMethods.setAttribute.call(etalon, 'onsubmit', 'return 1;');
        check();

        setProperty(form, 'onsubmit', function () {
            return 3;
        });
        etalon.onsubmit = function () {
            return 3;
        };
        check();

        form.removeAttribute('onsubmit');
        nativeMethods.removeAttribute.call(etalon, 'onsubmit');
        check();

        form.setAttribute('onsubmit', 'return 2;');
        nativeMethods.setAttribute.call(etalon, 'onsubmit', 'return 2;');
        check();

        setProperty(form, 'onsubmit', null);
        etalon.onsubmit = null;
        check();
    });
}

test('url', function () {
    var testUrlAttr = function (tagName, attr) {
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
        else if (tagName === 'form' || attr === 'formAction')
            resourceType = 'f';

        var proxy = urlUtils.getProxyUrl(dest, { resourceType: resourceType });

        setProperty(el, attr, dest);
        strictEqual(el[attr], proxy);
        strictEqual(getProperty(el, attr), dest);
        strictEqual(getAttr(), proxy);
        strictEqual(getWrapAttr(), dest);

        var newUrl      = '/image';
        var proxyNewUrl = urlUtils.getProxyUrl('/image', { resourceType: resourceType });

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
        { tagName: 'a', attr: 'href' },
        { tagName: 'script', attr: 'src' },
        { tagName: 'link', attr: 'href' },
        { tagName: 'form', attr: 'action' },
        { tagName: 'embed', attr: 'src' },
        { tagName: 'object', attr: 'data' }
    ];

    if (!browserUtils.isIE || browserUtils.version > 9) {
        testData = testData.concat([
            { tagName: 'input', attr: 'formAction' },
            { tagName: 'button', attr: 'formAction' }
        ]);
    }

    for (var i = 0; i < testData.length; i++)
        testUrlAttr(testData[i].tagName, testData[i].attr);
});

if (!browserUtils.isIE || browserUtils.version > 9) {
    test('formaction attribute in the form', function () {
        var form   = document.createElement('form');
        var input  = document.createElement('input');
        var button = document.createElement('button');

        input.type = 'submit';

        form.appendChild(input);
        form.appendChild(button);

        nativeMethods.setAttribute.call(form, 'action', urlUtils.getProxyUrl('./action.html', { resourceType: 'f' }));
        input.setAttribute('formaction', './input.html');
        button.setAttribute('formaction', './button.html');
        strictEqual(urlUtils.parseProxyUrl(input.formAction).resourceType, 'f');
        strictEqual(urlUtils.parseProxyUrl(button.formAction).resourceType, 'f');

        nativeMethods.setAttribute.call(form, 'action', urlUtils.getProxyUrl('./action.html', { resourceType: 'fi' }));
        input.setAttribute('formaction', './input.html');
        button.setAttribute('formaction', './button.html');
        strictEqual(urlUtils.parseProxyUrl(input.formAction).resourceType, 'fi');
        strictEqual(urlUtils.parseProxyUrl(button.formAction).resourceType, 'fi');
    });
}

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
    strictEqual(nativeMethods.getAttribute.call(input, storedAttr), domProcessor.AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER);

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
    strictEqual(nativeMethods.getAttribute.call(input, storedAttr), domProcessor.AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER);
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
    var checkElement = function (el, attr, resourceType) {
        var storedAttr     = domProcessor.getStoredAttrName(attr);
        var exprectedValue = 'http://' + location.host + '/sessionId' + resourceType +
                             '/https://example.com/Images/1.png';

        strictEqual(nativeMethods.getAttribute.call(el, storedAttr), '/Images/1.png', 'destination url stored');
        strictEqual(nativeMethods.getAttribute.call(el, attr), exprectedValue);
    };

    var html = ' <A iD = " fakeId1 " hRef = "/Images/1.png" attr="test" ></A>' +
               ' <form iD="fakeId3 " action="/Images/1.png"    attr="test" ></form>' +
               ' <link  iD = " fakeId5" href="/Images/1.png" attr="test" ></link>' +
               ' <' + 'script  iD = "  fakeId6  " sRc=  "/Images/1.png" attr= "test"' + '>' + '</' + 'scriPt' + '>';

    setProperty($container[0], 'innerHTML', html);

    checkElement($container.find('a')[0], 'href', '');
    checkElement($container.find('form')[0], 'action', '!f');
    checkElement($container.find('link')[0], 'href', '');
    checkElement($container.find('script')[0], 'src', '!s');
});

test('anchor with target attribute', function () {
    var anchor   = document.createElement('a');
    var url      = 'http://url.com/';
    var iframe   = document.createElement('iframe');
    var proxyUrl = urlUtils.getProxyUrl(url, { resourceType: 'i' });

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

test('HTMLElement.style', function () {
    var div                         = document.createElement('div');
    var proxiedBackgroundImageValue = 'url("' + urlUtils.getProxyUrl('index.png') + '")';

    div.setAttribute('style', 'background-image:url(index.png);');

    strictEqual(removeDoubleQuotes(div.style.backgroundImage), removeDoubleQuotes(proxiedBackgroundImageValue));
    strictEqual(div.getAttribute('style'), 'background-image:url(index.png);');

});

module('regression');

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

test('instances of attributesWrapper should be synchronized (GH-924)', function () {
    var input = document.createElement('input');

    var getProcessedAttributes = function () {
        return eval(processScript('input.attributes'));
    };

    input.setAttribute('name', 'test');

    var initialAttributesWrapper = getProcessedAttributes();

    input.setAttribute('maxLength', '10');

    var attr = document.createAttribute('class');

    attr.value = 'test';

    getProcessedAttributes().setNamedItem(attr);
    getProcessedAttributes().removeNamedItem('name');

    for (var i = 0; i < getProcessedAttributes().length; i++) {
        equal(getProcessedAttributes()[i].name, initialAttributesWrapper[i].name);
        equal(getProcessedAttributes()[i].value, initialAttributesWrapper[i].value);
    }
});

test('should hide "autocomplete" attribute form enumeration and existence check (GH-955)', function () {
    var input                 = document.createElement('input');
    var attributeNamespaceURI = input.attributes.getNamedItem('autocomplete').namespaceURI;

    ok(!input.hasAttribute('autocomplete'));
    ok(!input.hasAttributeNS(attributeNamespaceURI, 'autocomplete'));
    ok(!input.hasAttributes());
    strictEqual(getProperty(input, 'attributes').length, 0);

    input.setAttribute('autocomplete', 'on');

    ok(input.hasAttribute('autocomplete'));
    ok(input.hasAttributeNS(attributeNamespaceURI, 'autocomplete'));
    ok(input.hasAttributes());
    strictEqual(getProperty(input, 'attributes').length, 1);

    input.removeAttribute('autocomplete');
    ok(!input.hasAttribute('autocomplete'));
    ok(!input.hasAttributeNS(attributeNamespaceURI, 'autocomplete'));
    ok(!input.hasAttributes());
    strictEqual(getProperty(input, 'attributes').length, 0);

    input.setAttribute('test', 'test');
    ok(input.hasAttribute('test'));
    ok(input.hasAttributeNS(attributeNamespaceURI, 'test'));
    ok(input.hasAttributes());
    strictEqual(getProperty(input, 'attributes').length, 1);
});
