var INTERNAL_ATTRS = hammerhead.get('../processing/dom/internal-attributes');
var htmlUtils      = hammerhead.get('./utils/html');
var domProcessor   = hammerhead.get('./dom-processor');
var processScript  = hammerhead.get('../processing/script').processScript;
var styleProcessor = hammerhead.get('../processing/style');
var settings       = hammerhead.get('./settings');
var urlUtils       = hammerhead.get('./utils/url');
var sharedUrlUtils = hammerhead.get('../utils/url');

var nativeMethods  = hammerhead.nativeMethods;
var iframeSandbox  = hammerhead.sandbox.iframe;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open = nativeMethods.windowOpen;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

test('iframe', function () {
    var iframe                             = nativeMethods.createElement.call(document, 'iframe');
    var storedAttrName                     = domProcessor.getStoredAttrName('sandbox');

    nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-scripts');
    domProcessor.processElement(iframe);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-scripts');

    nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-same-origin');
    iframe['hammerhead|element-processed'] = false;
    domProcessor.processElement(iframe);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-same-origin');

    nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-scripts allow-same-origin');
    iframe['hammerhead|element-processed'] = false;
    domProcessor.processElement(iframe);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-scripts allow-same-origin');

    nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-same-origin allow-forms');
    iframe['hammerhead|element-processed'] = false;
    domProcessor.processElement(iframe);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-same-origin allow-forms allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-same-origin allow-forms');

    nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-scripts allow-forms');
    iframe['hammerhead|element-processed'] = false;
    domProcessor.processElement(iframe);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-forms allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-scripts allow-forms');

    nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-scripts allow-forms allow-same-origin');
    iframe['hammerhead|element-processed'] = false;
    domProcessor.processElement(iframe);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-scripts allow-forms allow-same-origin');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-scripts allow-forms allow-same-origin');

    nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-forms');
    iframe['hammerhead|element-processed'] = false;
    domProcessor.processElement(iframe);
    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-forms allow-same-origin allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-forms');
});

test('link in iframe', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');

    iframe.id = 'test';
    nativeMethods.appendChild.call(document.body, iframe);

    var link = nativeMethods.createElement.call(document, 'a');

    link.href = '/index.html';
    nativeMethods.appendChild.call(document.body, link);

    var iframeBody = iframe.contentDocument.body;

    // NOTE: In IE9, iframe's contentDocument does not have a 'body' element.
    // So, we need to create it manually.
    if (!iframeBody) {
        iframeBody = nativeMethods.createElement.call(iframe.contentDocument, 'body');
        nativeMethods.appendChild.call(iframe.contentDocument, iframeBody);
    }


    iframeBody.innerHTML = '<a href="/index.html"></a>';

    domProcessor.processElement(iframeBody.childNodes[0], urlUtils.convertToProxyUrl);
    domProcessor.processElement(link, urlUtils.convertToProxyUrl);

    strictEqual(urlUtils.parseProxyUrl(iframeBody.childNodes[0].href).resourceType, 'i');
    ok(!urlUtils.parseProxyUrl(link.href).resourceType);

    iframe.parentNode.removeChild(iframe);
    link.parentNode.removeChild(link);
});

test('script text', function () {
    var div             = nativeMethods.createElement.call(document, 'div');
    var script          = 'var host = location.host';
    var processedScript = processScript(script, true);

    nativeMethods.appendChild.call(document.body, div);
    div.innerHTML       = '\<script\>' + script + '\</script\>';

    domProcessor.processElement(div.firstChild);

    notEqual(script, processedScript);
    strictEqual(div.innerHTML.replace(/\s/g, ''), ('\<script\>' + processedScript +
                                                   '\</script\>').replace(/\s/g, ''));

    div.parentNode.removeChild(div);
});

test('comment inside script', function () {
    var testScript = function (scriptText) {
        var script = nativeMethods.createElement.call(document, 'script');

        script.text = scriptText;
        domProcessor.processElement(script);
        nativeMethods.appendChild.call(document.head, script);

        strictEqual(nativeMethods.getAttribute.call(window.commentTest, 'href'), urlUtils.getProxyUrl('http://domain.com'));

        nativeMethods.removeAttribute.call(window.commentTest, 'href');
        document.head.removeChild(script);
    };

    window.commentTest = document.createElement('a');

    testScript('\<!-- Begin comment\n' + 'window.commentTest.href = "http://domain.com";\n' + '//End comment -->');
    testScript('\<!-- Begin comment\n' + 'window.commentTest.href = "http://domain.com";\n' + ' -->');
});

test('attribute value', function () {
    var html =
            '<p class="location test"></p>' +
            '<p data-w="dslkfe"></p>' +
            '<p ' + hammerhead.DOM_SANDBOX_STORED_ATTR_KEY_PREFIX + 'test="location"></p>' +
            '<div id="URL"></div>' +
            '<div attr=""></div>' +
            '<div data-wrap="{simbols: -904, action: data}"></div>' +
            '<span class="Client"></span>' +
            '<span test="sdk"></span>' +
            '<span id="href"></span>' +
            '<div data-src="test"></div>';

    var expectedHTML =
            '<p class="location test"></p>' +
            '<p data-w="dslkfe"></p>' +
            '<p ' + hammerhead.DOM_SANDBOX_STORED_ATTR_KEY_PREFIX + 'test="location"></p>' +
            '<div id="URL"></div>' +
            '<div attr=""></div>' +
            '<div data-wrap="{simbols: -904, action: data}"></div>' +
            '<span class="Client"></span>' +
            '<span test="sdk"></span>' +
            '<span id="href"></span>' +
            '<div data-src="test"></div>';

    var container = nativeMethods.createElement.call(document, 'div');

    container.innerHTML = html;

    var elems = container.querySelectorAll('*');

    for (var i = 0; i < elems.length; i++)
        domProcessor.processElement(elems[i]);

    strictEqual(container.innerHTML, expectedHTML);
});

test('script src', function () {
    var storedSessionId = settings.get().sessionId;

    settings.get().sessionId = 'uid';

    var script = nativeMethods.createElement.call(document, 'script');

    script.src = 'http://domain.com';

    domProcessor.processElement(script, urlUtils.convertToProxyUrl);

    strictEqual(urlUtils.parseProxyUrl(script.src).resourceType, 's');

    settings.get().sessionId = storedSessionId;
});

test('event attributes', function () {
    var div            = nativeMethods.createElement.call(document, 'div');
    var attrValue      = 'window.location="test";';
    var processedValue = processScript(attrValue);
    var storedAttrName = domProcessor.getStoredAttrName('onclick');

    notEqual(processedValue, attrValue);

    nativeMethods.setAttribute.call(div, 'onclick', attrValue);

    domProcessor.processElement(div, function () {
    });

    strictEqual(nativeMethods.getAttribute.call(div, 'onclick'), processedValue);
    strictEqual(nativeMethods.getAttribute.call(div, storedAttrName), attrValue);
});

test('javascript protocol', function () {
    var link           = nativeMethods.createElement.call(document, 'a');
    var attrValue      = 'javascript:window.location="test";';
    var processedValue = 'javascript:' + processScript(attrValue.replace('javascript:', ''));

    notEqual(processedValue, attrValue);

    nativeMethods.setAttribute.call(link, 'onclick', attrValue);
    nativeMethods.setAttribute.call(link, 'href', attrValue);

    domProcessor.processElement(link, function () {
    });

    strictEqual(nativeMethods.getAttribute.call(link, 'onclick'), processedValue);
    strictEqual(nativeMethods.getAttribute.call(link, 'href'), processedValue);
    strictEqual(nativeMethods.getAttribute.call(link, domProcessor.getStoredAttrName('onclick')), attrValue);
    strictEqual(nativeMethods.getAttribute.call(link, domProcessor.getStoredAttrName('href')), attrValue);
});

test('anchor with target attribute', function () {
    var anchor   = nativeMethods.createElement.call(document, 'a');
    var testUrl  = 'http://url.com/';
    var proxyUrl = urlUtils.getProxyUrl(testUrl, { resourceType: 'i' });

    nativeMethods.setAttribute.call(anchor, 'href', testUrl);
    nativeMethods.setAttribute.call(anchor, 'target', 'iframeName');

    domProcessor.processElement(anchor, function (url, resourceType) {
        return urlUtils.getProxyUrl(url, { resourceType: resourceType });
    });

    strictEqual(nativeMethods.getAttribute.call(anchor, 'href'), proxyUrl);
    strictEqual(nativeMethods.getAttribute.call(anchor, domProcessor.getStoredAttrName('href')), testUrl);
});

test('autocomplete attribute', function () {
    var input1 = nativeMethods.createElement.call(document, 'input');
    var input2 = nativeMethods.createElement.call(document, 'input');
    var input3 = nativeMethods.createElement.call(document, 'input');
    var input4 = nativeMethods.createElement.call(document, 'input');

    nativeMethods.setAttribute.call(input1, 'autocomplete', 'on');
    nativeMethods.setAttribute.call(input2, 'autocomplete', 'off');
    nativeMethods.setAttribute.call(input3, 'autocomplete', '');

    domProcessor.processElement(input1);
    domProcessor.processElement(input2);
    domProcessor.processElement(input3);
    domProcessor.processElement(input4);

    var storedAutocompleteAttr = domProcessor.getStoredAttrName('autocomplete');

    strictEqual(nativeMethods.getAttribute.call(input1, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input1, storedAutocompleteAttr), 'on');

    strictEqual(nativeMethods.getAttribute.call(input2, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input2, storedAutocompleteAttr), 'off');

    strictEqual(nativeMethods.getAttribute.call(input3, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input3, storedAutocompleteAttr), '');

    strictEqual(nativeMethods.getAttribute.call(input4, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input4, storedAutocompleteAttr), 'none');
});

test('crossdomain src', function () {
    var url                   = 'http://cross.domain.com/';
    var proxyUrl              = urlUtils.getProxyUrl(url, {
        proxyHostname: location.hostname,
        proxyPort:     2001,
        resourceType:  'i'
    });
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;

    settings.get().crossDomainProxyPort = 2001;

    var processed = htmlUtils.processHtml('<iframe src="' + url + '"></iframe>');

    ok(processed.indexOf('src="' + proxyUrl) !== -1);
    ok(processed.indexOf(domProcessor.getStoredAttrName('src') + '="' + url + '"') !== -1);

    settings.get().crossDomainProxyPort = storedCrossDomainPort;
});

test('stylesheet', function () {
    var urlReplacer = function () {
        return 'replaced';
    };

    var check = function (css, expected) {
        strictEqual(styleProcessor.process(css, urlReplacer), expected);
    };

    check('a:hover {}', 'a[' + INTERNAL_ATTRS.hoverPseudoClass + '] {}');
    check('div { background-image: url(""); }', 'div { background-image: url(""); }');
    check('div { background-image: url(\'\'); }', 'div { background-image: url(\'\'); }');
    check('div { background-image: url(); }', 'div { background-image: url(); }');
    check('div { background-image: url("/image.png"); }', 'div { background-image: url("replaced"); }');
    check('div { background-image: url(\'/image.png\'); }', 'div { background-image: url(\'replaced\'); }');
    check('div { background-image: url(/image.png); }', 'div { background-image: url(replaced); }');
    check('@import "/image.png"', '@import "replaced"');
    check('@import \'/image.png\'', '@import \'replaced\'');
    check('@import ""', '@import ""');
    check('@import \'\'', '@import \'\'');
});

test('clean up stylesheet', function () {
    var url      = 'http://google.com/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);

    var check = function (css, expected) {
        strictEqual(styleProcessor.cleanUp(css, urlUtils.parseProxyUrl), expected);
    };

    check('a[' + INTERNAL_ATTRS.hoverPseudoClass + '] {}', 'a:hover {}');
    check('div { background-image: url(""); }', 'div { background-image: url(""); }');
    check('div { background-image: url(\'\'); }', 'div { background-image: url(\'\'); }');
    check('div { background-image: url(); }', 'div { background-image: url(); }');
    check('div { background-image: url("' + proxyUrl + '"); }', 'div { background-image: url("' + url + '"); }');
    check('div { background-image: url(\'' + proxyUrl + '\'); }', 'div { background-image: url(\'' + url + '\'); }');
    check('div { background-image: url(' + proxyUrl + '); }', 'div { background-image: url(' + url + '); }');
    check('@import "' + proxyUrl + '"', '@import "' + url + '"');
    check('@import \'' + proxyUrl + '\'', '@import \'' + url + '\'');
    check('@import ""', '@import ""');
    check('@import \'\'', '@import \'\'');
});

test('stylesheet after innerHTML', function () {
    var div   = nativeMethods.createElement.call(document, 'div');
    var style = nativeMethods.createElement.call(document, 'style');

    nativeMethods.appendChild.call(document.body, style);

    var check = function (cssText) {
        strictEqual(cssText.indexOf(styleProcessor.STYLESHEET_PROCESSING_START_COMMENT), 0);
        strictEqual(cssText.indexOf(styleProcessor.STYLESHEET_PROCESSING_START_COMMENT, 1), -1);
        strictEqual(cssText.replace(/^[\s\S]+url\(([\s\S]+)\)[\s\S]+$/, '$1'), urlUtils.getProxyUrl('http://domain.com'));
    };

    eval(processScript('div.innerHTML = "<style>.rule { background: url(http://domain.com) }</style>";'));
    check(div.children[0].innerHTML);

    eval(processScript('div.innerHTML = div.innerHTML;'));
    check(div.children[0].innerHTML);

    eval(processScript('style.innerHTML = ".rule { background: url(http://domain.com) }";'));
    check(style.innerHTML);

    eval(processScript('style.innerHTML = style.innerHTML;'));
    check(style.innerHTML);
});

test('special pages (GH-339)', function () {
    var link   = document.createElement('a');
    var image  = document.createElement('img');
    var iframe = document.createElement('iframe');

    sharedUrlUtils.SPECIAL_PAGES.forEach(function (specialPagUrl) {
        link.setAttribute('href', specialPagUrl);
        image.setAttribute('src', specialPagUrl);
        iframe.setAttribute('src', specialPagUrl);

        var linkHrefUrl  = nativeMethods.getAttribute.call(link, 'href');
        var proxyUrl     = urlUtils.getProxyUrl(specialPagUrl);
        var imageSrcUrl  = nativeMethods.getAttribute.call(image, 'src');
        var iframeSrcUrl = nativeMethods.getAttribute.call(iframe, 'src');

        strictEqual(linkHrefUrl, proxyUrl);
        strictEqual(imageSrcUrl, specialPagUrl);
        strictEqual(iframeSrcUrl, specialPagUrl);
    });
});

module('should create a proxy url for the img src attribute if the image has the load handler (GH-651)', function () {
    module('onload property', function () {
        asyncTest('attach the load handler before setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

            document.body.appendChild(img);

            setProperty(img, 'onload', function () {
                strictEqual(img.src, imgProxyUrl);

                setProperty(img, 'onload', null);
                img.setAttribute('src', imgUrl);

                strictEqual(urlUtils.parseUrl(img.src).partAfterHost, imgUrl);

                img.parentNode.removeChild(img);
                start();
            });

            img.setAttribute('src', imgUrl);
        });

        asyncTest('attach the load handler after setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

            document.body.appendChild(img);

            img.setAttribute('src', imgUrl);

            setProperty(img, 'onload', function () {
                strictEqual(img.src, imgProxyUrl);

                setProperty(img, 'onload', null);
                img.setAttribute('src', imgUrl);

                strictEqual(urlUtils.parseUrl(img.src).partAfterHost, imgUrl);

                img.parentNode.removeChild(img);

                start();
            });
        });
    });

    module('addEventListener', function () {
        asyncTest('attach the load handler before setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

            document.body.appendChild(img);

            var testLoadHandler = function () {
                strictEqual(img.src, imgProxyUrl);

                img.removeEventListener('load', testLoadHandler);
                img.setAttribute('src', imgUrl);

                strictEqual(urlUtils.parseUrl(img.src).partAfterHost, imgUrl);

                img.parentNode.removeChild(img);
                start();
            };

            img.addEventListener('load', testLoadHandler);
            img.setAttribute('src', imgUrl);
        });

        asyncTest('attach the load handler after setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

            document.body.appendChild(img);

            var testLoadHandler = function () {
                strictEqual(img.src, imgProxyUrl);

                img.removeEventListener('load', testLoadHandler);
                img.setAttribute('src', imgUrl);

                strictEqual(urlUtils.parseUrl(img.src).partAfterHost, imgUrl);

                img.parentNode.removeChild(img);
                start();
            };

            img.setAttribute('src', imgUrl);
            img.addEventListener('load', testLoadHandler);
        });
    });

    if (window.attachEvent) {
        module('attachEvent', function () {
            asyncTest('attach the load handler before setting up the src', function () {
                var img         = document.createElement('img');
                var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
                var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

                document.body.appendChild(img);

                var testHandler = function () {
                    strictEqual(img.src, imgProxyUrl);

                    img.detachEvent('onload', testHandler);
                    img.setAttribute('src', imgUrl);

                    strictEqual(urlUtils.parseUrl(img.src).partAfterHost, imgUrl);

                    img.parentNode.removeChild(img);
                    start();
                };

                img.attachEvent('onload', testHandler);
                img.setAttribute('src', imgUrl);
            });

            asyncTest('attach the load handler after setting up the src', function () {
                var img         = document.createElement('img');
                var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
                var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

                document.body.appendChild(img);

                var testHandler = function () {
                    strictEqual(img.src, imgProxyUrl);

                    img.detachEvent('onload', testHandler);
                    img.setAttribute('src', imgUrl);

                    strictEqual(urlUtils.parseUrl(img.src).partAfterHost, imgUrl);
                    img.parentNode.removeChild(img);
                    start();
                };

                img.setAttribute('src', imgUrl);
                img.attachEvent('onload', testHandler);
            });
        });
    }
});

module('should ensure that target contains the existing window name (GH-247) (GH-745)', function () {
    test('link', function () {
        var link = document.createElement('a');

        link.href   = 'http://example.com';
        link.target = 'wrong_window_name';
        link.addEventListener('click', function (e) {
            strictEqual(link.target, '_self');

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
            strictEqual(link.target, '_self');

            e.preventDefault();
            link.parentNode.removeChild(link);
        });

        document.body.appendChild(link);
        document.body.appendChild(base);

        eventSimulator.click(link);
    });

    test('base with keyword target', function () {
        var link = document.createElement('a');
        var base = document.createElement('base');

        base.target = '_Parent';
        link.href   = 'http://example.com';
        link.addEventListener('click', function (e) {
            strictEqual(link.target, '_self');

            e.preventDefault();
            link.parentNode.removeChild(link);
        });

        document.body.appendChild(link);
        document.body.appendChild(base);

        eventSimulator.click(link);
    });

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
            strictEqual(area.target, '_self');

            e.preventDefault();
            map.parentNode.removeChild(map);
            img.parentNode.removeChild(img);
        });

        map.appendChild(area);
        document.body.appendChild(img);
        document.body.appendChild(map);

        eventSimulator.click(area);
    });

    test('form', function () {
        var form  = document.createElement('form');
        var input = document.createElement('input');

        input.type  = 'submit';
        form.target = 'wrong_window_name';
        form.action = 'http://example.com';
        form.appendChild(input);

        form.addEventListener('submit', function (e) {
            strictEqual(form.target, '_self');

            e.preventDefault();
            form.parentNode.removeChild(form);
        });
        document.body.appendChild(form);

        eventSimulator.click(input);
    });

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
            strictEqual(form.target, '_self');

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

test('remove the "integrity" attribute from the link and script tags (GH-235)', function () {
    var script = nativeMethods.createElement.call(document, 'script');
    var link   = nativeMethods.createElement.call(document, 'link');

    nativeMethods.setAttribute.call(script, 'integrity', 'sha384-Li9vy3DqF8tnTXuiaAJuML3ky+er10rcgNR/VqsVpcw+ThHmYcwiB1pbOxEbzJr7');
    nativeMethods.setAttribute.call(link, 'integrity', 'sha384-Li9vy3DqF8tnTXuiaAJuML3ky+er10rcgNR/VqsVpcw+ThHmYcwiB1pbOxEbzJr7');

    var urlReplacer = function (url) {
        return url;
    };

    domProcessor.processElement(script, urlReplacer);
    domProcessor.processElement(link, urlReplacer);

    ok(!script.hasAttribute('integrity'));
    ok(!link.hasAttribute('integrity'));
});

asyncTest('link with target="_parent" in iframe (T216999)', function () {
    var iframe         = document.createElement('iframe');
    var storedAttrName = domProcessor.getStoredAttrName('href');

    iframe.id  = 'test';
    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/dom-processor/iframe.html');

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var link = nativeMethods.getElementById.call(iframe.contentDocument, 'link');

            strictEqual(nativeMethods.getAttribute.call(link, storedAttrName), '/index.html');

            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

test('iframe with javascript protocol in \'src\' attribute value must be processed (T135513)', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');
    var src    = 'javascript:"<html><body><a id=\'test\' data-attr=\"123\">link</a></body></html>"';

    nativeMethods.setAttribute.call(iframe, 'src', src);

    domProcessor.processElement(iframe, function (url) {
        return url;
    });

    var srcAttr       = nativeMethods.getAttribute.call(iframe, 'src');
    var storedSrcAttr = nativeMethods.getAttribute.call(iframe, domProcessor.getStoredAttrName('src'));

    notEqual(srcAttr, src);
    strictEqual(srcAttr, 'javascript:\'' +
                         htmlUtils.processHtml('<html><body><a id=\'test\' data-attr="123">link</a></body></html>') +
                         '\'');
    strictEqual(storedSrcAttr, src);
});

test('the URL attribute must be set to an empty string on the server only once (T295078) (GH-159)', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');

    nativeMethods.setAttribute.call(iframe, 'src', '/should_not_be_changed');
    // NOTE: Simulates processing an iframe on the server.
    nativeMethods.setAttribute.call(iframe, domProcessor.getStoredAttrName('src'), '');

    domProcessor.processElement(iframe, function () {
        return 'fail';
    });

    strictEqual(nativeMethods.getAttribute.call(iframe, 'src'), '/should_not_be_changed');
});

test('remove the meta tag with http-equiv="Content-Security-Policy" attribute from document (GH-243)', function () {
    var metaTag = nativeMethods.createElement.call(document, 'meta');

    nativeMethods.setAttribute.call(metaTag, 'http-equiv', 'Content-Security-Policy');
    nativeMethods.setAttribute.call(metaTag, 'content', "script-src https: 'unsafe-eval';");

    domProcessor.processElement(metaTag);

    ok(!metaTag.hasAttribute('http-equiv'));
    ok(!metaTag.hasAttribute('content'));
});

test('remove the meta tag with http-equiv="Content-Security-Policy" attribute from document (tag properties added via setAttribute) (GH-243)', function () {
    var metaTag = document.createElement('meta');

    metaTag.setAttribute('id', 'metaContentSecurityPolicy');
    metaTag.setAttribute('http-equiv', 'Content-Security-Policy');
    metaTag.setAttribute('content', "script-src https: 'unsafe-eval';");
    document.head.appendChild(metaTag);

    ok(!metaTag.hasAttribute('http-equiv'));
    ok(!metaTag.hasAttribute('content'));
    metaTag.parentNode.removeChild(metaTag);
});

test('script and style content added via a child text node must be overridden (GH-259)', function () {
    var style          = document.createElement('style');
    var styleTextNode1 = document.createTextNode('div.class1 { background-image: url("/image1.png"); }');
    var styleTextNode2 = document.createTextNode('div.class2 { background-image: url("/image2.png"); }');

    style.appendChild(styleTextNode1);
    ok(style.childNodes[0].data.indexOf(urlUtils.getProxyUrl('/image1.png')) > -1);
    style.insertBefore(styleTextNode2, styleTextNode1);
    ok(style.childNodes[0].data.indexOf(urlUtils.getProxyUrl('/image2.png')) > -1);

    var script          = document.createElement('script');
    var scriptTextNode1 = document.createTextNode('var host1 = location.host');
    var scriptTextNode2 = document.createTextNode('var host2 = location.host');

    script.appendChild(scriptTextNode1);
    ok(script.childNodes[0].data.indexOf('var host1 =  __get$(__get$Loc(location),"host")') > -1);
    script.insertBefore(scriptTextNode2, scriptTextNode1);
    ok(script.childNodes[0].data.indexOf('var host2 =  __get$(__get$Loc(location),"host")') > -1);
});

test('node.replaceChild must be overridden (GH-264)', function () {
    var style          = document.createElement('style');
    var styleTextNode1 = document.createTextNode('div.class1 { background-image: url("/image1.png"); }');
    var styleTextNode2 = document.createTextNode('div.class2 { background-image: url("/image2.png"); }');

    style.appendChild(styleTextNode1);
    ok(style.innerHTML.indexOf(urlUtils.getProxyUrl('/image1.png')) > -1);

    style.replaceChild(styleTextNode2, styleTextNode1);
    ok(style.innerHTML.indexOf(urlUtils.getProxyUrl('/image2.png')) > -1);
});

asyncTest('script error when a new element is added to a "body" element that is not in the DOM (GH-296)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test_unique_id_l7ajkl';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument = iframe.contentDocument;

            iframeDocument.documentElement.removeChild(iframeDocument.body);

            var newIframeBody = iframeDocument.createElement('body');
            var div1          = iframeDocument.createElement('div');
            var div2          = iframeDocument.createElement('div');
            var div3          = iframeDocument.createElement('div');

            newIframeBody.appendChild(div1);
            strictEqual(newIframeBody.lastChild, div1);
            newIframeBody.appendChild(div2);
            strictEqual(newIframeBody.lastChild, div2);
            newIframeBody.insertBefore(div3, null);
            strictEqual(newIframeBody.lastChild, div3);

            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

test('xlink:href attribute of svg elements should be overriden (GH-434)(GH-514)', function () {
    var svgNameSpaceUrl   = 'http://www.w3.org/2000/svg';
    var xlinkNameSpaceUrl = 'http://www.w3.org/1999/xlink';
    var use               = document.createElementNS(svgNameSpaceUrl, 'use');
    var svgUrl            = 'http://domain.com/test.svg#rect';
    var div               = document.createElement('div');

    use.setAttribute('xlink:href', '#svg-rect');
    strictEqual(nativeMethods.getAttribute.call(use, 'xlink:href'), '#svg-rect');

    use.setAttribute('xlink:href', svgUrl);
    strictEqual(nativeMethods.getAttribute.call(use, 'xlink:href'), urlUtils.getProxyUrl(svgUrl));

    div.setAttribute('xlink:href', svgUrl);
    strictEqual(nativeMethods.getAttribute.call(div, 'xlink:href'), svgUrl);

    use.setAttributeNS(xlinkNameSpaceUrl, 'xlink:href', '#svg-rect');
    strictEqual(nativeMethods.getAttributeNS.call(use, xlinkNameSpaceUrl, 'href'), '#svg-rect');

    use.setAttributeNS(xlinkNameSpaceUrl, 'xlink:href', svgUrl);
    strictEqual(nativeMethods.getAttributeNS.call(use, xlinkNameSpaceUrl, 'href'), urlUtils.getProxyUrl(svgUrl));
});

test('xml:base attribute of svg element should be overriden (GH-477)', function () {
    var xmlNameSpaceUrl = 'http://www.w3.org/XML/1998/namespace';
    var svg             = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var circle          = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    var url             = 'http://domain.com/';
    var subDomainUrl    = 'http://sub.domain.com/';
    var div             = document.createElement('div');

    svg.appendChild(circle);

    svg.setAttribute('xml:base', url);
    strictEqual(nativeMethods.getAttribute.call(svg, 'xml:base'), urlUtils.getProxyUrl(url));

    circle.setAttribute('xml:base', subDomainUrl);
    strictEqual(nativeMethods.getAttribute.call(circle, 'xml:base'), urlUtils.getProxyUrl(subDomainUrl));

    div.setAttribute('xml:base', url);
    strictEqual(nativeMethods.getAttribute.call(div, 'xml:base'), url);

    svg.setAttributeNS(xmlNameSpaceUrl, 'xml:base', url);
    strictEqual(nativeMethods.getAttributeNS.call(svg, xmlNameSpaceUrl, 'base'), urlUtils.getProxyUrl(url));

    circle.setAttributeNS(xmlNameSpaceUrl, 'xml:base', subDomainUrl);
    strictEqual(nativeMethods.getAttributeNS.call(circle, xmlNameSpaceUrl, 'base'), urlUtils.getProxyUrl(subDomainUrl));

    svg.setAttributeNS(xmlNameSpaceUrl, 'base', url);
    strictEqual(nativeMethods.getAttributeNS.call(svg, xmlNameSpaceUrl, 'base'), urlUtils.getProxyUrl(url));

    circle.setAttributeNS(xmlNameSpaceUrl, 'base', subDomainUrl);
    strictEqual(nativeMethods.getAttributeNS.call(circle, xmlNameSpaceUrl, 'base'), urlUtils.getProxyUrl(subDomainUrl));
});
