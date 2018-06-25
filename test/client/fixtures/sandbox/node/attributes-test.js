var INTERNAL_PROPS   = hammerhead.get('../processing/dom/internal-properties');
var DomProcessor     = hammerhead.get('../processing/dom');
var domProcessor     = hammerhead.get('./dom-processor');
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

            var onsubmit = form.onsubmit;

            strictEqual(onsubmit ? onsubmit() : onsubmit, etalon.onsubmit ? etalon.onsubmit() : etalon.onsubmit);
        };

        check();

        form.setAttribute('onsubmit', 'return 1;');
        nativeMethods.setAttribute.call(etalon, 'onsubmit', 'return 1;');
        check();

        form.onsubmit = function () {
            return 3;
        };
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

        form.onsubmit = null;
        etalon.onsubmit = null;
        check();
    });
}

test('url attributes overridden by descriptor', function () {
    var testUrlAttr = function (tagName, attr, getter) {
        var el         = document.createElement(tagName);
        var storedAttr = DomProcessor.getStoredAttrName(attr);
        var namespace  = 'http://www.w3.org/1999/xhtml';

        var getAttr = function () {
            return nativeMethods.getAttribute.call(el, attr);
        };

        var getWrapAttr = function () {
            return nativeMethods.getAttribute.call(el, storedAttr);
        };

        el.setAttribute(attr, '');

        var emptyAttrValue = getter.call(el);
        var dest           = 'http://dest.com/';
        var resourceType   = null;

        if (tagName === 'script')
            resourceType = 's';
        else if (tagName === 'form' || attr === 'formAction')
            resourceType = 'f';

        var proxy = urlUtils.getProxyUrl(dest, { resourceType: resourceType });

        el[attr] = dest;

        strictEqual(getter.call(el), proxy);
        strictEqual(el[attr], dest);
        strictEqual(getAttr(), proxy);
        strictEqual(getWrapAttr(), dest);

        var newUrl      = '/image';
        var proxyNewUrl = urlUtils.getProxyUrl('/image', { resourceType: resourceType });

        el.setAttribute(attr, newUrl);
        strictEqual(getter.call(el), proxyNewUrl);
        strictEqual(el[attr], urlUtils.parseProxyUrl(proxyNewUrl).destUrl);
        strictEqual(getAttr(), proxyNewUrl);
        strictEqual(getWrapAttr(), newUrl);

        el[attr] = '';

        strictEqual(getWrapAttr(), '');
        strictEqual(getAttr(), '');
        strictEqual(getter.call(el), emptyAttrValue);
        strictEqual(el[attr], destLocation.get());

        el.removeAttribute(attr);
        strictEqual(getWrapAttr(), null);
        strictEqual(getAttr(), null);

        if (attr === 'action' && featureDetection.emptyActionAttrFallbacksToTheLocation)
            strictEqual(el[attr], destLocation.get());
        else
            strictEqual(el[attr], '');

        el.setAttributeNS(namespace, attr, dest);
        strictEqual(nativeMethods.getAttributeNS.call(el, namespace, attr), proxy);
        strictEqual(nativeMethods.getAttributeNS.call(el, namespace, storedAttr), dest);
    };

    var testData = [
        { tagName: 'object', attr: 'data', getter: nativeMethods.objectDataGetter },
        { tagName: 'script', attr: 'src', getter: nativeMethods.scriptSrcGetter },
        { tagName: 'embed', attr: 'src', getter: nativeMethods.embedSrcGetter },
        { tagName: 'a', attr: 'href', getter: nativeMethods.anchorHrefGetter },
        { tagName: 'link', attr: 'href', getter: nativeMethods.linkHrefGetter },
        { tagName: 'form', attr: 'action', getter: nativeMethods.formActionGetter },
        { tagName: 'input', attr: 'formAction', getter: nativeMethods.inputFormActionGetter },
        { tagName: 'button', attr: 'formAction', getter: nativeMethods.buttonFormActionGetter }
    ];

    if (nativeMethods.htmlManifestGetter)
        testData.push({ tagName: 'html', attr: 'manifest', getter: nativeMethods.htmlManifestGetter });

    for (var i = 0; i < testData.length; i++)
        testUrlAttr(testData[i].tagName, testData[i].attr, testData[i].getter);
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
        strictEqual(urlUtils.parseProxyUrl(nativeMethods.inputFormActionGetter.call(input)).resourceType, 'f');
        strictEqual(urlUtils.parseProxyUrl(nativeMethods.buttonFormActionGetter.call(button)).resourceType, 'f');

        nativeMethods.setAttribute.call(form, 'action', urlUtils.getProxyUrl('./action.html', { resourceType: 'fi' }));
        input.setAttribute('formaction', './input.html');
        button.setAttribute('formaction', './button.html');
        strictEqual(urlUtils.parseProxyUrl(nativeMethods.inputFormActionGetter.call(input)).resourceType, 'fi');
        strictEqual(urlUtils.parseProxyUrl(nativeMethods.buttonFormActionGetter.call(button)).resourceType, 'fi');
    });
}

test('script src', function () {
    var storedSessionId = settings.get().sessionId;

    settings.get().sessionId = 'sessionId';

    var script = document.createElement('script');

    document[INTERNAL_PROPS.documentCharset] = 'utf-8';

    script.setAttribute('src', 'http://google.com');

    var parsedProxyUrl = urlUtils.parseProxyUrl(nativeMethods.scriptSrcGetter.call(script));

    strictEqual(parsedProxyUrl.resourceType, 's');
    strictEqual(parsedProxyUrl.charset, 'utf-8');

    document[INTERNAL_PROPS.documentCharset] = null;

    settings.get().sessionId = storedSessionId;
});

test('"integrity" attribute (GH-235)', function () {
    var script         = nativeMethods.createElement.call(document, 'script');
    var link           = nativeMethods.createElement.call(document, 'link');
    var integrityValue = 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC';

    function checkIntegrityAttr (el, hasIntegrityAttr) {
        ok(hasIntegrityAttr ? el.hasAttribute('integrity') : !el.hasAttribute('integrity'));
        strictEqual(el.getAttribute('integrity'), hasIntegrityAttr ? integrityValue : null);
        strictEqual(nativeMethods.getAttribute.call(el, 'integrity'), null);
    }

    script.setAttribute('integrity', integrityValue);
    link.setAttribute('integrity', integrityValue);

    checkIntegrityAttr(script, true);
    checkIntegrityAttr(link, true);


    // Check integrity attribute when only NS integrity attribute sets (incorrect integrity attribute)
    script = nativeMethods.createElement.call(document, 'script');
    link   = nativeMethods.createElement.call(document, 'link');

    script.setAttributeNS('http://www.example.com/ns/specialspace', 'specialspace:integrity', integrityValue);
    script.setAttributeNS('http://www.example.com/ns/specialspace', 'specialspace:integrity', integrityValue);

    checkIntegrityAttr(script, false);
    checkIntegrityAttr(link, false);
});

if (nativeMethods.scriptIntegrityGetter && nativeMethods.linkIntegrityGetter) {
    test('"integrity" property', function () {
        var integrityValue = 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC';
        var script         = nativeMethods.createElement.call(document, 'script');
        var link           = nativeMethods.createElement.call(document, 'link');

        function checkIntegrityAttr (el) {
            strictEqual(el.integrity, integrityValue);
            strictEqual(nativeMethods.getAttribute.call(el, 'integrity'), null);
        }

        script.integrity = integrityValue;
        link.integrity   = integrityValue;

        checkIntegrityAttr(script);
        checkIntegrityAttr(link);
    });
}

test('iframe with "javascript: <html>...</html>" src', function () {
    return createTestIframe({ src: 'javascript:"<script>var d = {}; d.src = 1; window.test = true;<' + '/script>"' })
        .then(function (iframe) {
            ok(iframe.contentWindow.test);
        });
});

asyncTest('iframe html src', function () {
    var iframe = document.createElement('iframe');
    var src    = 'javascript:\'<html><body><a id=\\\'test\\\' data-attr="123">link</a></body></html>\'';

    iframe.id = 'test56';
    processDomMeth(iframe);

    iframe.setAttribute('src', src);

    var srcAttr       = nativeMethods.getAttribute.call(iframe, 'src');
    var storedSrcAttr = nativeMethods.getAttribute.call(iframe, DomProcessor.getStoredAttrName('src'));

    notEqual(srcAttr, src);
    strictEqual(srcAttr, 'javascript:' + processScript(src.replace('javascript:', ''), false, true));
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

test('onclick', function () {
    var link      = document.createElement('a');
    var attrValue = 'location.href="managers.aspx";';

    link.setAttribute('onclick', attrValue);

    var attr       = nativeMethods.getAttribute.call(link, 'onclick');
    var storedAttr = nativeMethods.getAttribute.call(link, DomProcessor.getStoredAttrName('onclick'));

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
    var storedAttr = nativeMethods.getAttribute.call(link, DomProcessor.getStoredAttrName('onclick'));

    notEqual(attr, storedAttr);
    strictEqual(storedAttr, attrValue);
    strictEqual(attr, 'javascript:' + processScript(attrValue.replace('javascript:', '')));
    strictEqual(link.getAttribute('onclick'), attrValue);
});

test('url - javascript: protocol', function () {
    var anchor    = document.createElement('a');
    var hrefValue = 'javascript:location.href="managers.aspx?Delete=814";';

    anchor.setAttribute('href', hrefValue);

    var href       = nativeMethods.getAttribute.call(anchor, 'href');
    var storedHref = nativeMethods.getAttribute.call(anchor, DomProcessor.getStoredAttrName('href'));

    notEqual(href, storedHref);
    strictEqual(storedHref, hrefValue);
    strictEqual(href, 'javascript:' + processScript(hrefValue.replace('javascript:', ''), false, true));
    strictEqual(anchor.getAttribute('href'), hrefValue);
});

test('sandbox attribute', function () {
    var attr       = 'sandbox';
    var storedAttr = DomProcessor.getStoredAttrName(attr);
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

test('sandbox property', function () {
    var iframe                 = document.createElement('iframe');
    var storedAttr             = DomProcessor.getStoredAttrName('sandbox');
    var nativeIframe           = nativeMethods.createElement.call(document, 'iframe');
    var nativeSandboxTokenList = nativeMethods.iframeSandboxGetter.call(nativeIframe);

    strictEqual(iframe.sandbox.length, nativeSandboxTokenList.length);

    iframe.sandbox = 'allow-scripts';
    // NOTE: Strange behavior in Chrome and Firefox. Native sandbox setter calls overridden getter
    // and sets value to returned non-native DOMTokenList
    var overriddenDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'sandbox');

    Object.defineProperty(HTMLIFrameElement.prototype, 'sandbox', { get: nativeMethods.iframeSandboxGetter, configurable: true });
    nativeMethods.iframeSandboxSetter.call(nativeIframe, 'allow-scripts');
    Object.defineProperty(HTMLIFrameElement.prototype, 'sandbox', overriddenDescriptor);

    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts');
    strictEqual(iframe.sandbox.length, nativeSandboxTokenList.length);
    strictEqual(iframe.sandbox.item(0), nativeSandboxTokenList.item(0));

    iframe.setAttribute('sandbox', 'allow-forms');
    nativeMethods.setAttribute.call(nativeIframe, 'sandbox', 'allow-forms');

    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-forms allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-forms');
    strictEqual(iframe.sandbox.length, nativeSandboxTokenList.length);
    strictEqual(iframe.sandbox.item(0), nativeSandboxTokenList.item(0));

    iframe.setAttribute('sandbox', '');
    nativeMethods.setAttribute.call(nativeIframe, 'sandbox', '');

    iframe.sandbox.add('allow-scripts');
    nativeMethods.tokenListAdd.call(nativeSandboxTokenList, 'allow-scripts');

    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts');
    strictEqual(iframe.sandbox.length, nativeSandboxTokenList.length);
    strictEqual(iframe.sandbox.item(0), nativeSandboxTokenList.item(0));

    iframe.sandbox.remove('allow-scripts');
    nativeMethods.tokenListRemove.call(nativeSandboxTokenList, 'allow-scripts');

    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), ' allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), '');
    strictEqual(iframe.sandbox.length, nativeSandboxTokenList.length);

    iframe.sandbox.toggle('allow-scripts');
    nativeMethods.tokenListToggle.call(nativeSandboxTokenList, 'allow-scripts');

    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-scripts');
    strictEqual(iframe.sandbox.length, nativeSandboxTokenList.length);
    strictEqual(iframe.sandbox.item(0), nativeSandboxTokenList.item(0));

    if (iframe.sandbox.replace) {
        iframe.sandbox.replace('allow-scripts', 'allow-forms');
        nativeMethods.tokenListReplace.call(nativeSandboxTokenList, 'allow-scripts', 'allow-forms');

        strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-forms allow-same-origin allow-scripts');
        strictEqual(nativeMethods.getAttribute.call(iframe, storedAttr), 'allow-forms');
        strictEqual(iframe.sandbox.length, nativeSandboxTokenList.length);
        strictEqual(iframe.sandbox.item(0), nativeSandboxTokenList.item(0));
    }

    if (iframe.sandbox.supports) {
        strictEqual(iframe.sandbox.supports('allow-scripts'), nativeMethods.tokenListSupports.call(nativeSandboxTokenList, 'allow-scripts'));
        strictEqual(iframe.sandbox.supports('test123'), nativeMethods.tokenListSupports.call(nativeSandboxTokenList, 'test123'));
    }
});

test('crossdomain iframe', function () {
    var iframe        = document.createElement('iframe');
    var storedSrcAttr = DomProcessor.getStoredAttrName('src');

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

    iframe.src = crossDomainUrl;

    strictEqual(nativeMethods.iframeSrcGetter.call(iframe), crossDomainProxyUrl);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'src'), crossDomainProxyUrl);
    strictEqual(nativeMethods.getAttribute.call(iframe, storedSrcAttr), crossDomainUrl);

    iframe.src = location.toString() + '?param';

    strictEqual(nativeMethods.iframeSrcGetter.call(iframe), proxyUrl);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'src'), proxyUrl);
    strictEqual(iframe.getAttribute('src'), location.toString() + '?param');

    urlUtils.getProxyUrl                  = savedGetProxyUrl;
    urlUtils.getCrossDomainIframeProxyUrl = savedGetCrossDomainIframeProxyUrl;
});

test('input.autocomplete', function () {
    var input      = document.createElement('input');
    var etalon     = nativeMethods.createElement.call(document, 'input');
    var storedAttr = DomProcessor.getStoredAttrName('autocomplete');

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
    window[evName] = function () {
        return 'value';
    };

    ok(window[evName]);
});

test('element.innerHTML', function () {
    settings.get().sessionId = 'sessionId';

    var container    = document.createElement('div');
    var checkElement = function (el, attr, resourceType) {
        var storedAttr     = DomProcessor.getStoredAttrName(attr);
        var exprectedValue = 'http://' + location.host + '/sessionId' + resourceType +
                             '/https://example.com/Images/1.png';

        strictEqual(nativeMethods.getAttribute.call(el, storedAttr), '/Images/1.png', 'destination url stored');
        strictEqual(nativeMethods.getAttribute.call(el, attr), exprectedValue);
    };

    container.innerHTML = '<A iD = " fakeId1 " hRef = "/Images/1.png" attr="test"></A>' +
                          '<form iD="fakeId3 " action="/Images/1.png" attr="test"></form>' +
                          '<link  iD = " fakeId5" href="/Images/1.png" attr="test" ></link>' +
                          '<script  iD = "  fakeId6  " sRc= "/Images/1.png" attr= "test">' + '</' + 'scriPt>';

    checkElement(container.querySelector('a'), 'href', '');
    checkElement(container.querySelector('form'), 'action', '!f');
    checkElement(container.querySelector('link'), 'href', '');
    checkElement(container.querySelector('script'), 'src', '!s');
});

// NOTE: IE11 adds extra 'NS' namespace to stored xlink href attribute during processing (GH-1083)
if (!browserUtils.isIE11) {
    test('SVGImageElement with an existing xlink:href should contain only one stored href attribute after href.baseVal is changed', function () {
        var div               = document.createElement('div');
        var xlinkNamespaceUrl = 'http://www.w3.org/1999/xlink';
        var baseVal           = 'http://example.com/test.svg';

        div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="' + xlinkNamespaceUrl + '">\n' +
                        '<image xlink:href="' + baseVal + '"></image>\n' +
                        '</svg>';

        var image = div.querySelector('image');

        var checkHrefStoredAttribute = function (el) {
            strictEqual(nativeMethods.getAttribute.call(el, 'xlink:' + DomProcessor.getStoredAttrName('href')), baseVal);
            notOk(nativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('href')));
            notOk(nativeMethods.getAttributeNS.call(el, xlinkNamespaceUrl, 'xlink:' + DomProcessor.getStoredAttrName('href')));
            notOk(nativeMethods.getAttributeNS.call(el, xlinkNamespaceUrl, DomProcessor.getStoredAttrName('href')));
        };

        checkHrefStoredAttribute(image);

        baseVal            = 'http://example.com/test-1.svg';
        image.href.baseVal = baseVal;

        checkHrefStoredAttribute(image);
    });
}

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
    strictEqual(nativeMethods.getAttribute.call(anchor, DomProcessor.getStoredAttrName('href')), url);
    strictEqual(anchor.getAttribute('href'), url);
    strictEqual(urlUtils.parseProxyUrl(nativeHref).resourceType, 'i');

    iframe.parentNode.removeChild(iframe);
});

test('anchor.toString()', function () {
    var anchor = document.createElement('a');
    var url    = 'http://some.domain.com/';

    strictEqual(anchor.toString(), '');

    anchor.setAttribute('href', url);

    strictEqual(anchor.toString(), url);
});

if (window.Node.prototype.hasOwnProperty('attributes')) {
    test('the "attributes" property should return null for textNode in ie11', function () {
        strictEqual(document.createTextNode('text').attributes, null);
    });
}

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

test('instance of attributesWrapper should be synchronized with native attributes (GH-924)', function () {
    var input = document.createElement('input');
    var nativeAttributes = nativeMethods.elementAttributesGetter.call(input);

    notStrictEqual(input.attributes, nativeAttributes);

    strictEqual(nativeAttributes.length, 2);
    strictEqual(input.attributes.length, 0);

    input.setAttribute('name', 'test');
    input.setAttribute('maxLength', '10');

    strictEqual(input.attributes.length, 2);

    var attr = document.createAttribute('class');

    attr.value = 'test';

    input.attributes.setNamedItem(attr);

    strictEqual(input.attributes.length, 3);

    input.attributes.removeNamedItem('name');

    strictEqual(input.attributes.length, 2);

    for (var i = 0; i < 2; i++) {
        var attrName = input.attributes[i].name;

        strictEqual(input.attributes[i], nativeAttributes[attrName]);
        strictEqual(input.attributes[attrName], nativeAttributes[attrName]);
    }

    input.attributes.removeNamedItem('maxLength');
    input.attributes.removeNamedItem('class');

    strictEqual(input.attributes.length, 0);

    input.disabled = true;

    strictEqual(input.attributes.length, 1);
    strictEqual(input.attributes[0].name, 'disabled');
});

test('should hide "autocomplete" attribute form enumeration and existence check (GH-955)', function () {
    var input                 = document.createElement('input');
    var attributeNamespaceURI = nativeMethods.elementAttributesGetter.call(input).getNamedItem('autocomplete').namespaceURI;

    ok(!input.hasAttribute('autocomplete'));
    ok(!input.hasAttributeNS(attributeNamespaceURI, 'autocomplete'));
    ok(!input.hasAttributes());
    strictEqual(input.attributes.length, 0);

    input.setAttribute('autocomplete', 'on');

    ok(input.hasAttribute('autocomplete'));
    ok(input.hasAttributeNS(attributeNamespaceURI, 'autocomplete'));
    ok(input.hasAttributes());
    strictEqual(input.attributes.length, 1);

    input.removeAttribute('autocomplete');
    ok(!input.hasAttribute('autocomplete'));
    ok(!input.hasAttributeNS(attributeNamespaceURI, 'autocomplete'));
    ok(!input.hasAttributes());
    strictEqual(input.attributes.length, 0);

    input.setAttribute('test', 'test');
    ok(input.hasAttribute('test'));
    ok(input.hasAttributeNS(attributeNamespaceURI, 'test'));
    ok(input.hasAttributes());
    strictEqual(input.attributes.length, 1);
});

test('the "Maximum call stack size exceeded" error should not occurs when the setAttribute or getAttribute function overridden by client (GH-1452)', function () {
    var setAttributeWrapper = HTMLElement.prototype.setAttribute;
    var getAttributeWrapper = HTMLElement.prototype.getAttribute;

    eval(processScript('var propsRegExp = /^(action|autocomplete|data|formaction|href|manifest|sandbox|src|target|style)$/;' +
                       'HTMLElement.prototype.setAttribute = function(name, value) {' +
                       '    return propsRegExp.test(name) ? this[name] = value : this.setAttribute(name, value);' +
                       '};' +
                       'HTMLElement.prototype.getAttribute = function(name) {' +
                       '    return propsRegExp.test(name) ? this[name] : this.setAttribute(name);' +
                       '};'));

    var testCases = {
        action:       document.createElement('form'),
        autocomplete: document.createElement('input'),
        data:         document.createElement('object'),
        formaction:   document.createElement('input'),
        href:         document.createElement('a'),
        sandbox:      document.createElement('iframe'),
        src:          document.createElement('img'),
        target:       document.createElement('a'),
        style:        document.createElement('span')
    };

    if (nativeMethods.htmlManifestGetter)
        testCases.manifest = document.createElement('html');

    try {
        Object.keys(testCases)
            .forEach(function (attr) {
                var element = testCases[attr];

                element[attr] = 'value';
                // eslint-disable-next-line no-unused-expressions
                element[attr];
            });

        ok(true);
    }
    catch (e) {
        ok(false, e);
    }

    HTMLElement.prototype.setAttribute = setAttributeWrapper;
    HTMLElement.prototype.getAttribute = getAttributeWrapper;
});
