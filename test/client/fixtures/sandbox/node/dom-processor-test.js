var INTERNAL_ATTRS = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_attributes;
var htmlUtils      = hammerhead.utils.html;
var DomProcessor   = hammerhead.processors.DomProcessor;
var domProcessor   = hammerhead.processors.domProcessor;
var processScript  = hammerhead.utils.processing.script.processScript;
var styleProcessor = hammerhead.processors.styleProcessor;
var settings       = hammerhead.settings;
var urlUtils       = hammerhead.utils.url;
var sharedUrlUtils = hammerhead.sharedUtils.url;
var destLocation   = hammerhead.utils.destLocation;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

var nativeMethods  = hammerhead.nativeMethods;
var elementSandbox = hammerhead.sandbox.node.element;
var shadowUI       = hammerhead.sandbox.shadowUI;

test('iframe', function () {
    var iframe         = nativeMethods.createElement.call(document, 'iframe');
    var storedAttrName = DomProcessor.getStoredAttrName('sandbox');

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

test('anchor in iframe', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');

    iframe.id = 'test';
    nativeMethods.appendChild.call(document.body, iframe);

    var anchor = nativeMethods.createElement.call(document, 'a');

    nativeMethods.anchorHrefSetter.call(anchor, '/index.html');
    nativeMethods.appendChild.call(document.body, anchor);

    var iframeBody = iframe.contentDocument.body;

    nativeMethods.elementInnerHTMLSetter.call(iframeBody, '<a href="/index.html"></a>');

    domProcessor.processElement(iframeBody.childNodes[0], urlUtils.convertToProxyUrl);
    domProcessor.processElement(anchor, urlUtils.convertToProxyUrl);

    strictEqual(urlUtils.parseProxyUrl(nativeMethods.anchorHrefGetter.call(iframeBody.childNodes[0])).resourceType, 'i');
    ok(!urlUtils.parseProxyUrl(nativeMethods.anchorHrefGetter.call(anchor)).resourceType);

    iframe.parentNode.removeChild(iframe);
    anchor.parentNode.removeChild(anchor);
});

test('form resoure type if target iframe added on client', function () {
    var iframe = document.createElement('iframe');
    var form   = document.createElement('form');

    iframe.name = 'target-iframe';
    iframe.src  = 'http://localhost:2000/';

    nativeMethods.setAttribute.call(form, 'target', 'target-iframe');

    form.action = 'http://example.com';

    nativeMethods.appendChild.call(document.body, form);
    document.body.appendChild(iframe);

    strictEqual(urlUtils.parseProxyUrl(nativeMethods.formActionGetter.call(form)).resourceType, 'if');

    iframe.parentNode.removeChild(iframe);
    form.parentNode.removeChild(form);
});

if (nativeMethods.append) {
    test('Element.prototype.append', function () {
        var div  = document.createElement('div');
        var root = shadowUI.getRoot();

        document.body.append(div);

        strictEqual(nativeMethods.nodeLastChildGetter.call(document.body), root);
        strictEqual(nativeMethods.nodePrevSiblingGetter.call(root), div);

        var isScriptElementAddedEventRaised = false;

        elementSandbox.on(elementSandbox.SCRIPT_ELEMENT_ADDED_EVENT, function () {
            isScriptElementAddedEventRaised = true;
        });

        div.append('text node', document.createTextNode('123'), document.createElement('script'));

        ok(isScriptElementAddedEventRaised);

        document.body.removeChild(div);

        var text = 'foobar';
        var span = document.createElement('span');
        var p    = document.createElement('p');

        document.body.append(text, span, p);

        strictEqual(nativeMethods.nodeLastChildGetter.call(document.body), root);
        strictEqual(nativeMethods.nodePrevSiblingGetter.call(root), p);
        strictEqual(nativeMethods.nodePrevSiblingGetter.call(p), span);
        strictEqual(nativeMethods.nodePrevSiblingGetter.call(span).data, text);

        document.body.removeChild(span.previousSibling);
        document.body.removeChild(span);
        document.body.removeChild(p);

        var onlyText = 'only text';

        document.body.append(onlyText);

        strictEqual(nativeMethods.nodeLastChildGetter.call(document.body), root);
        strictEqual(nativeMethods.nodePrevSiblingGetter.call(root).data, onlyText);

        document.body.removeChild(root.previousSibling);
    });

    test('Element.prototype.append for objects (GH-2730)', function () {
        var container = document.createElement('div');


        container.append(null);
        container.append();
        container.append(void 0);
        container.append({ test: 'hi' });
        container.append(1234);

        strictEqual(container.textContent, 'nullundefined[object Object]1234');
    });
}

if (nativeMethods.prepend) {
    test('Element.prototype.prepend', function () {
        var div = document.createElement('div');

        document.body.appendChild(div);

        var isScriptElementAddedEventRaised = false;

        elementSandbox.on(elementSandbox.SCRIPT_ELEMENT_ADDED_EVENT, function () {
            isScriptElementAddedEventRaised = true;
        });

        div.prepend('text node', document.createTextNode('123'), document.createElement('script'));

        ok(isScriptElementAddedEventRaised);

        document.body.removeChild(div);
    });
}

if (nativeMethods.after) {
    test('Element.prototype.after', function () {
        var parent = document.createElement('div');
        var child  = document.createElement('p');

        parent.appendChild(child);
        document.body.appendChild(parent);

        var isScriptElementAddedEventRaised = false;

        elementSandbox.on(elementSandbox.SCRIPT_ELEMENT_ADDED_EVENT, function () {
            isScriptElementAddedEventRaised = true;
        });

        child.after('text node', document.createElement('script'));

        ok(isScriptElementAddedEventRaised);
        strictEqual(parent.childNodes[0].tagName.toLowerCase(), 'p');
        strictEqual(parent.childNodes[1].data, 'text node');
        strictEqual(parent.childNodes[2].tagName.toLowerCase(), 'script');

        document.body.removeChild(parent);
    });
}

if (nativeMethods.remove) {
    test('Element.prototype.remove', function () {
        var div = document.createElement('div');

        document.body.appendChild(div);

        var onElementRemovedCalled = false;

        elementSandbox._onElementRemoved = function () {
            onElementRemovedCalled = true;
            delete elementSandbox._onElementRemoved;
        };

        div.remove();

        ok(onElementRemovedCalled);
        strictEqual(nativeMethods.nodeParentNodeGetter.call(div), null);
    });
}

test('Element.prototype.insertAdjacentElement', function () {
    var isScriptElementAddedEventRaised = false;

    elementSandbox.on(elementSandbox.SCRIPT_ELEMENT_ADDED_EVENT, function () {
        isScriptElementAddedEventRaised = true;
    });

    var parent = document.createElement('div');

    parent.insertAdjacentElement('beforebegin', document.createElement('script'));
    parent.insertAdjacentElement('afterend', document.createElement('script'));

    notOk(isScriptElementAddedEventRaised);

    var root   = shadowUI.getRoot();
    var script = document.createElement('script');

    document.body.appendChild(parent);
    document.body.insertAdjacentElement('beforeend', script);

    ok(isScriptElementAddedEventRaised);
    strictEqual(nativeMethods.nodePrevSiblingGetter.call(root), script);
    strictEqual(nativeMethods.nodePrevSiblingGetter.call(script), parent);

    isScriptElementAddedEventRaised = false;
    parent.insertAdjacentElement('beforeend', document.createElement('a'));
    parent.insertAdjacentElement('afterbegin', document.createElement('script'));

    ok(isScriptElementAddedEventRaised);
    strictEqual(parent.children[0].tagName.toLowerCase(), 'script');
    strictEqual(parent.children[1].tagName.toLowerCase(), 'a');

    document.body.removeChild(script);
    document.body.removeChild(parent);
});

test('Element.prototype.insertAdjacentText', function () {
    var script = document.createElement('script');
    var div    = document.createElement('div');

    script.insertAdjacentText('afterbegin', 'window["insertAdjacentText test data"] = location.host');
    document.body.appendChild(script);
    document.body.appendChild(div);

    strictEqual(window['insertAdjacentText test data'], 'example.com');

    div.insertAdjacentText('beforeend', 'text before root');
    div.insertAdjacentText('beforeend', 1);
    div.insertAdjacentText('beforeend', {});

    strictEqual(div.innerText, 'text before root1[object Object]');

    document.body.removeChild(script);
    document.body.removeChild(div);
});

if (nativeMethods.elementReplaceWith) {
    test('Element.prototype.replaceWith', function () {
        var div      = document.createElement('div');
        var childDiv = document.createElement('div');

        div.appendChild(childDiv);

        document.body.appendChild(div);

        var script                          = document.createElement('script');
        var isScriptElementAddedEventRaised = false;

        elementSandbox.on(elementSandbox.SCRIPT_ELEMENT_ADDED_EVENT, function () {
            isScriptElementAddedEventRaised = true;
        });

        childDiv.replaceWith(script);

        ok(isScriptElementAddedEventRaised);
        strictEqual(nativeMethods.nodeLastChildGetter.call(div), script);

        var anchor2 = document.createElement('a');
        var anchor3 = document.createElement('a');

        script.replaceWith(anchor2, anchor3);

        strictEqual(nativeMethods.nodeFirstChildGetter.call(div), anchor2);
        strictEqual(nativeMethods.nodeLastChildGetter.call(div), anchor3);

        div.removeChild(div.firstChild);

        div.firstChild.replaceWith('Text 0', 'Text 1');

        strictEqual(div.childNodes[0].data, 'Text 0');
        strictEqual(div.childNodes[1].data, 'Text 1');

        div.parentNode.removeChild(div);
    });
}

test('comment inside script', function () {
    var testScript = function (scriptText) {
        var script = nativeMethods.createElement.call(document, 'script');

        nativeMethods.scriptTextSetter.call(script, scriptText);
        domProcessor.processElement(script);
        nativeMethods.appendChild.call(document.head, script);

        strictEqual(nativeMethods.getAttribute.call(window.commentTest, 'href'), urlUtils.getProxyUrl('http://domain.com'));

        nativeMethods.removeAttribute.call(window.commentTest, 'href');
        document.head.removeChild(script);
    };

    window.commentTest = document.createElement('a');

    testScript('<!-- Begin comment\n' + 'window.commentTest.href = "http://domain.com";\n' + '//End comment -->');
    testScript('<!-- Begin comment\n' + 'window.commentTest.href = "http://domain.com";\n' + ' -->');
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

    nativeMethods.elementInnerHTMLSetter.call(container, html);

    var elems = container.querySelectorAll('*');

    for (var i = 0; i < elems.length; i++)
        domProcessor.processElement(elems[i]);

    strictEqual(nativeMethods.elementInnerHTMLGetter.call(container), expectedHTML);
    strictEqual(container.innerHTML, expectedHTML);
});

test('script src', function () {
    var storedSessionId = settings.get().sessionId;

    settings.get().sessionId = 'uid';

    var script = nativeMethods.createElement.call(document, 'script');

    nativeMethods.scriptSrcSetter.call(script, 'http://domain.com');

    domProcessor.processElement(script, urlUtils.convertToProxyUrl);

    strictEqual(urlUtils.parseProxyUrl(nativeMethods.scriptSrcGetter.call(script)).resourceType, 's');

    settings.get().sessionId = storedSessionId;
});

test('event attributes', function () {
    var div            = nativeMethods.createElement.call(document, 'div');
    var attrValue      = 'window.location="test";';
    var processedValue = processScript(attrValue);
    var storedAttrName = DomProcessor.getStoredAttrName('onclick');

    notEqual(processedValue, attrValue);

    nativeMethods.setAttribute.call(div, 'onclick', attrValue);

    domProcessor.processElement(div, function () {
    });

    strictEqual(nativeMethods.getAttribute.call(div, 'onclick'), processedValue);
    strictEqual(nativeMethods.getAttribute.call(div, storedAttrName), attrValue);
});

test('javascript protocol', function () {
    var anchor                     = nativeMethods.createElement.call(document, 'a');
    var attrValue                  = 'javascript:window.location="test";';
    var processedValueForUrlAttr   = 'javascript:' + processScript(attrValue.replace('javascript:', ''), false, true);
    var processedValueForEventAttr = 'javascript:' + processScript(attrValue.replace('javascript:', ''));

    notEqual(processedValueForUrlAttr, attrValue);
    notEqual(processedValueForEventAttr, attrValue);

    nativeMethods.setAttribute.call(anchor, 'onclick', attrValue);
    nativeMethods.setAttribute.call(anchor, 'href', attrValue);

    domProcessor.processElement(anchor, function () {
    });

    strictEqual(nativeMethods.getAttribute.call(anchor, 'onclick'), processedValueForEventAttr);
    strictEqual(nativeMethods.getAttribute.call(anchor, 'href'), processedValueForUrlAttr);
    strictEqual(nativeMethods.getAttribute.call(anchor, DomProcessor.getStoredAttrName('onclick')), attrValue);
    strictEqual(nativeMethods.getAttribute.call(anchor, DomProcessor.getStoredAttrName('href')), attrValue);
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

    var storedAutocompleteAttr = DomProcessor.getStoredAttrName('autocomplete');

    strictEqual(nativeMethods.getAttribute.call(input1, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input1, storedAutocompleteAttr), 'on');

    strictEqual(nativeMethods.getAttribute.call(input2, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input2, storedAutocompleteAttr), 'off');

    strictEqual(nativeMethods.getAttribute.call(input3, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input3, storedAutocompleteAttr), '');

    strictEqual(nativeMethods.getAttribute.call(input4, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input4, storedAutocompleteAttr), domProcessor.AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER);
});

test('crossdomain src', function () {
    var url      = 'http://cross.domain.com/';
    var proxyUrl = urlUtils.getProxyUrl(url, {
        proxyHostname: location.hostname,
        proxyPort:     2001,
        resourceType:  'i',
    });

    var processed = htmlUtils.processHtml('<iframe src="' + url + '"></iframe>');

    ok(processed.indexOf('src="' + proxyUrl) !== -1);
    ok(processed.indexOf(DomProcessor.getStoredAttrName('src') + '="' + url + '"') !== -1);
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
    check('img[src' + INTERNAL_ATTRS.storedAttrPostfix + '="url.png"] {}', 'img[src="url.png"] {}');
});

test('style processor clean up edge cases', function () {
    var STYLESHEET_PROCESSING_START_COMMENT = '/*hammerhead|stylesheet|start*/';
    var STYLESHEET_PROCESSING_END_COMMENT   = '/*hammerhead|stylesheet|end*/';

    var css1 = 'START';
    var css2 = 'START';
    var css3 = 'START';

    for (var i = 0; i < 5; i++) {
        css1 += '     ';
        css1 += STYLESHEET_PROCESSING_START_COMMENT;
        css1 += '   *   ';
        css1 += STYLESHEET_PROCESSING_END_COMMENT;
        css1 += '   +   ';

        css2 += '     ';
        css2 += STYLESHEET_PROCESSING_START_COMMENT;
        css2 += '      ';
        css2 += STYLESHEET_PROCESSING_END_COMMENT;
        css2 += '      ';

        css3 += '     ';
        css3 += STYLESHEET_PROCESSING_START_COMMENT;
        css3 += '  1  2  ';
        css3 += STYLESHEET_PROCESSING_END_COMMENT;
        css3 += ' 3   4  ';
    }

    css1 += 'END';
    css2 += 'END';
    css3 += 'END';

    css1 = styleProcessor.cleanUp(css1, urlUtils.parseProxyUrl);
    css2 = styleProcessor.cleanUp(css2, urlUtils.parseProxyUrl);
    css3 = styleProcessor.cleanUp(css3, urlUtils.parseProxyUrl);

    strictEqual(css1, 'START   *   +   *   +   *   +   *   +   *   +   END');
    strictEqual(css2, 'START                              END');
    strictEqual(css3, 'START  1  2  3   4  1  2  3   4  1  2  3   4  1  2  3   4  1  2  3   4  END');
});

test('style processor clean up performance', function () {
    var STYLESHEET_PROCESSING_START_COMMENT = '/*hammerhead|stylesheet|start*/';
    var STYLESHEET_PROCESSING_END_COMMENT   = '/*hammerhead|stylesheet|end*/';

    var css = 'START';

    for (var i = 0; i < 10000; i++) {
        for (var j = 0; j < 500; j++)
            css += ' ';

        css += '<td data-cell-id="168_216§40_279"></td>';

        for (var j = 0; j < 500; j++)
            css += ' ';
    }

    css += STYLESHEET_PROCESSING_START_COMMENT;
    css += '\n \n';
    css += STYLESHEET_PROCESSING_END_COMMENT;
    css += 'END';

    var start = Date.now();

    styleProcessor.cleanUp(css, urlUtils.parseProxyUrl);

    var end = Date.now();

    ok(end - start < 5000);
});

test('special pages (GH-339)', function () {
    var anchor = document.createElement('a');
    var image  = document.createElement('img');
    var iframe = document.createElement('iframe');

    sharedUrlUtils.SPECIAL_PAGES.forEach(function (specialPagUrl) {
        anchor.setAttribute('href', specialPagUrl);
        image.setAttribute('src', specialPagUrl);
        iframe.setAttribute('src', specialPagUrl);

        var proxyUrl      = urlUtils.getProxyUrl(specialPagUrl);
        var anchorHrefUrl = nativeMethods.getAttribute.call(anchor, 'href');
        var imageSrcUrl   = nativeMethods.getAttribute.call(image, 'src');
        var iframeSrcUrl  = nativeMethods.getAttribute.call(iframe, 'src');

        strictEqual(anchorHrefUrl, proxyUrl);
        strictEqual(imageSrcUrl, specialPagUrl);
        strictEqual(iframeSrcUrl, specialPagUrl);
    });
});


test('add element with `formaction` tag to the form', function () {
    var form  = document.createElement('form');
    var input = document.createElement('input');

    nativeMethods.formActionSetter.call(form, urlUtils.getProxyUrl('./form.html', { resourceType: 'if' }));

    input.setAttribute('formAction', './input.html');
    strictEqual(nativeMethods.inputFormActionGetter.call(input), urlUtils.getProxyUrl('./input.html', { resourceType: 'f' }));

    form.appendChild(input);
    strictEqual(nativeMethods.inputFormActionGetter.call(input), urlUtils.getProxyUrl('./input.html', { resourceType: 'if' }));
});


module('should create a proxy url for the img src and srcset attributes if the image has the load handler (GH-651)', function () {
    function createUrlsSet (url, size) {
        var urlsSet = [];

        for (var i = 0; i < size; i++)
            urlsSet.push(url + ' ' + (i + 1) + 'x');

        return urlsSet.join(',');
    }

    module('onload property', function () {
        var origin = location.origin || location.protocol + location.host;

        test('attach the load handler before setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

            img.onload = function () {};

            img.setAttribute('src', imgUrl);

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);

            img.onload = null;

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);

            img.setAttribute('src', imgUrl);

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);
        });

        test('attach the load handler after setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

            img.setAttribute('src', imgUrl);

            strictEqual(urlUtils.parseUrl(nativeMethods.imageSrcGetter.call(img)).partAfterHost, imgUrl);

            img.onload = null;

            strictEqual(urlUtils.parseUrl(nativeMethods.imageSrcGetter.call(img)).partAfterHost, imgUrl);

            img.setAttribute('src', imgUrl);

            strictEqual(urlUtils.parseUrl(nativeMethods.imageSrcGetter.call(img)).partAfterHost, imgUrl);

            img.onload = function () {};

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);
        });

        asyncTest('attach the load handler after setting up the src(image is loaded)', function () {
            var img                  = document.createElement('img');
            var storedForcedLocation = destLocation.getLocation();

            destLocation.forceLocation('http://localhost/sessionId/' + location.origin);

            img.src = origin + '/image.png?rand=' + Math.random() + '&timeout=0';

            nativeMethods.htmlElementOnloadSetter.call(img, function () {
                var onloadHandlerCalled = false;

                img.onload = function () {
                    onloadHandlerCalled = true;
                };

                img.addEventListener('load', function () {
                    onloadHandlerCalled = true;
                });

                setTimeout(function () {
                    img.onload = null;
                    ok(!onloadHandlerCalled);
                    destLocation.forceLocation(storedForcedLocation);
                    start();
                }, 1000);
            });
        });

        asyncTest('attach the load handler after setting up the src(image is not loaded)', function () {
            var img                  = document.createElement('img');
            var storedForcedLocation = destLocation.getLocation();

            destLocation.forceLocation('http://localhost/sessionId/' + location.origin);

            img.src    = origin + '/image.png?rand=' + Math.random() + '&timeout=300';
            img.onload = function () {
                ok(true);
                destLocation.forceLocation(storedForcedLocation);
                start();
            };
        });

        asyncTest('attach the load handler after setting up the src(image is loaded and set new src)', function () {
            var img                  = document.createElement('img');
            var storedForcedLocation = destLocation.getLocation();

            destLocation.forceLocation('http://localhost/sessionId/' + location.origin);

            img.src = origin + '/image.png?rand=' + Math.random() + '&timeout=0';

            nativeMethods.htmlElementOnloadSetter.call(img, function () {
                img.onload = function () {
                    img.onload = null;
                    ok(true);
                    destLocation.forceLocation(storedForcedLocation);
                    start();
                };

                img.src = origin + '/image.png?rand=' + Math.random() + '&timeout=0';
            });
        });

        asyncTest('attach the load handler after setting up the cached src(image is loaded, but load event is not emitted) (GH-1959)', function () {
            var img                  = document.createElement('img');
            var imgSrc               = origin + '/image.png?rand=' + Math.random() + '&timeout=0&expires=' +
                                       new Date(Date.now() + 1e6).toUTCString();
            var storedForcedLocation = destLocation.getLocation();

            destLocation.forceLocation('http://localhost/sessionId/' + location.origin);

            img.src = imgSrc;
            nativeMethods.htmlElementOnloadSetter.call(img, function () {
                var anotherImg = document.createElement('img');

                anotherImg.src    = imgSrc;
                anotherImg.onload = function () {
                    ok(true);
                    destLocation.forceLocation(storedForcedLocation);
                    start();
                };
            });
        });
    });

    module('addEventListener', function () {
        test('attach the load handler before setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);
            var listener    = function () {};

            img.addEventListener('load', listener);
            img.setAttribute('src', imgUrl);

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);

            img.removeEventListener('load', listener);

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);

            img.setAttribute('src', imgUrl);

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);
        });

        test('attach the load handler after setting up the src', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);

            img.setAttribute('src', imgUrl);

            strictEqual(urlUtils.parseUrl(nativeMethods.imageSrcGetter.call(img)).partAfterHost, imgUrl);

            img.addEventListener('load', function () {});

            strictEqual(nativeMethods.imageSrcGetter.call(img), imgProxyUrl);
        });


        test('attach the load handler before setting up the srcset', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);
            var listener    = function () {};
            var setSize     = 2;

            var imgUrlsSet      = createUrlsSet(imgUrl, setSize);
            var imgProxyUrlsSet = createUrlsSet(imgProxyUrl, setSize);

            img.addEventListener('load', listener);
            img.setAttribute('srcset', imgUrlsSet);

            strictEqual(nativeMethods.imageSrcsetGetter.call(img), imgProxyUrlsSet);

            img.removeEventListener('load', listener);

            strictEqual(nativeMethods.imageSrcsetGetter.call(img), imgProxyUrlsSet);

            img.setAttribute('src', imgUrlsSet);

            strictEqual(nativeMethods.imageSrcsetGetter.call(img), imgProxyUrlsSet);
        });

        test('attach the load handler after setting up the srcset', function () {
            var img         = document.createElement('img');
            var imgUrl      = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
            var imgProxyUrl = urlUtils.getProxyUrl(imgUrl);
            var setSize     = 2;

            var imgUrlsSet      = createUrlsSet(imgUrl, setSize);
            var imgProxyUrlsSet = createUrlsSet(imgProxyUrl, setSize);

            img.setAttribute('srcset', imgUrlsSet);

            var imgSrcset = nativeMethods.imageSrcsetGetter.call(img).split(',');

            for (let i = 0; i < imgSrcset.length; i++)
                imgSrcset[i] = urlUtils.parseUrl(imgSrcset[i]).partAfterHost;

            strictEqual(imgSrcset.join(','), imgUrlsSet);

            img.addEventListener('load', function () {});

            strictEqual(nativeMethods.imageSrcsetGetter.call(img), imgProxyUrlsSet);
        });
    });
});

module('regression');

test('process the "integrity" attribute in the link and script tags (GH-235)', function () {
    var script         = nativeMethods.createElement.call(document, 'script');
    var link           = nativeMethods.createElement.call(document, 'link');
    var integrityValue = 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC';

    var urlReplacer = function (url) {
        return url;
    };

    function checkIntegrityAttr (el) {
        ok(el.hasAttribute('integrity'));
        strictEqual(el.getAttribute('integrity'), integrityValue);
        strictEqual(nativeMethods.getAttribute.call(el, 'integrity'), null);
    }

    nativeMethods.setAttribute.call(script, 'integrity', integrityValue);
    nativeMethods.setAttribute.call(link, 'integrity', integrityValue);

    domProcessor.processElement(script, urlReplacer);
    domProcessor.processElement(link, urlReplacer);

    checkIntegrityAttr(script);
    checkIntegrityAttr(link);
});

test('link with target="_parent" in iframe (T216999)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/dom-processor/iframe.html') })
        .then(function (iframe) {
            var anchor         = nativeMethods.getElementById.call(iframe.contentDocument, 'anchor');
            var storedAttrName = DomProcessor.getStoredAttrName('href');

            strictEqual(nativeMethods.getAttribute.call(anchor, storedAttrName), '/index.html');
        });
});

test('iframe with javascript protocol in "src" attribute value must be processed (T135513)', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');
    var src    = 'javascript:"<html><body><a id=\'test\' data-attr=\\"123\\">link</a></body></html>"';

    nativeMethods.setAttribute.call(iframe, 'src', src);

    domProcessor.processElement(iframe, function (url) {
        return url;
    });

    var srcAttr       = nativeMethods.getAttribute.call(iframe, 'src');
    var storedSrcAttr = nativeMethods.getAttribute.call(iframe, DomProcessor.getStoredAttrName('src'));

    notEqual(srcAttr, src);
    strictEqual(srcAttr, 'javascript:' + processScript(src.replace('javascript:', ''), false, true));
    strictEqual(storedSrcAttr, src);
});

test('the URL attribute must be set to an empty string on the server only once (T295078) (GH-159)', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');

    nativeMethods.setAttribute.call(iframe, 'src', '/should_not_be_changed');
    // NOTE: Simulates processing an iframe on the server.
    nativeMethods.setAttribute.call(iframe, DomProcessor.getStoredAttrName('src'), '');

    domProcessor.processElement(iframe, function () {
        return 'fail';
    });

    strictEqual(nativeMethods.getAttribute.call(iframe, 'src'), '/should_not_be_changed');
});

test('remove the meta tag with http-equiv="Content-Security-Policy" attribute from document (GH-243)', function () {
    var metaTag = nativeMethods.createElement.call(document, 'meta');

    nativeMethods.setAttribute.call(metaTag, 'http-equiv', 'Content-Security-Policy');
    nativeMethods.setAttribute.call(metaTag, 'content', 'script-src https: \'unsafe-eval\';');

    domProcessor.processElement(metaTag);

    ok(!metaTag.hasAttribute('http-equiv'));
    ok(!metaTag.hasAttribute('content'));
});

test('remove the meta tag with http-equiv="Content-Security-Policy" attribute from document (tag properties added via setAttribute) (GH-243)', function () {
    var metaTag = document.createElement('meta');

    metaTag.setAttribute('id', 'metaContentSecurityPolicy');
    metaTag.setAttribute('http-equiv', 'Content-Security-Policy');
    metaTag.setAttribute('content', 'script-src https: \'unsafe-eval\';');
    document.head.appendChild(metaTag);

    ok(!metaTag.hasAttribute('http-equiv'));
    ok(metaTag.hasAttribute('content'));
    metaTag.parentNode.removeChild(metaTag);
});

test('allow to set the content attribute to meta tag', function () {
    var metaTag = document.createElement('meta');

    metaTag.setAttribute('http-equiv', 'refresh');
    metaTag.setAttribute('content', 'url');

    strictEqual(metaTag.getAttribute('http-equiv'), null);
    strictEqual(metaTag.getAttribute('content'), 'url');

    metaTag.setAttribute('name', 'csrf-token');
    metaTag.setAttribute('content', '1234567');

    strictEqual(metaTag.getAttribute('name'), 'csrf-token');
    strictEqual(metaTag.getAttribute('content'), '1234567');

    metaTag.setAttribute('http-equiv', 'Content-Security-Policy');
    metaTag.setAttribute('content', 'script-src');

    strictEqual(metaTag.getAttribute('http-equiv'), null);
    strictEqual(metaTag.getAttribute('content'), 'script-src');

    metaTag.httpEquiv = 'Content-Security-Policy';
    metaTag.content   = 'style-src';

    strictEqual(metaTag.getAttribute('http-equiv'), null);
    strictEqual(metaTag.getAttribute('content'), 'style-src');
    strictEqual(metaTag.httpEquiv, '');
    strictEqual(metaTag.content, 'style-src');
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
    ok(script.childNodes[0].data.indexOf('var host1 =  __get$Loc(location) .host') > -1);
    script.insertBefore(scriptTextNode2, scriptTextNode1);
    ok(script.childNodes[0].data.indexOf('var host2 =  __get$Loc(location) .host') > -1);

    if (!nativeMethods.append)
        return;

    style.append('div.class3 { background-image: url("/image3.png"); }',
        'div.class4 { background-image: url("/image4.png"); }',
        document.createTextNode('div.class5 { background-image: url("/image5.png"); }'));
    ok(style.childNodes[2].data.indexOf(urlUtils.getProxyUrl('/image3.png')) > -1);
    ok(style.childNodes[3].data.indexOf(urlUtils.getProxyUrl('/image4.png')) > -1);
    ok(style.childNodes[4].data.indexOf(urlUtils.getProxyUrl('/image5.png')) > -1);

    script.append('var port = location.port',
        document.createTextNode('var hostname = location.hostname'),
        'var protocol = location.protocol');
    ok(script.childNodes[2].data.indexOf('var port =  __get$Loc(location) .port') > -1);
    ok(script.childNodes[3].data.indexOf('var hostname =  __get$Loc(location) .hostname') > -1);
    ok(script.childNodes[4].data.indexOf('var protocol =  __get$Loc(location) .protocol') > -1);
});

test('node.replaceChild must be overridden (GH-264)', function () {
    var style          = document.createElement('style');
    var styleTextNode1 = document.createTextNode('div.class1 { background-image: url("/image1.png"); }');
    var styleTextNode2 = document.createTextNode('div.class2 { background-image: url("/image2.png"); }');

    style.appendChild(styleTextNode1);
    ok(nativeMethods.elementInnerHTMLGetter.call(style).indexOf(urlUtils.getProxyUrl('/image1.png')) > -1);

    style.replaceChild(styleTextNode2, styleTextNode1);
    ok(nativeMethods.elementInnerHTMLGetter.call(style).indexOf(urlUtils.getProxyUrl('/image2.png')) > -1);
});

test('script error when a new element is added to a "body" element that is not in the DOM (GH-296)', function () {
    return createTestIframe()
        .then(function (iframe) {
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
        });
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

test('should reprocess tags that doesn\'t processed on server side (GH-838)', function () {
    var src = getSameDomainPageUrl('../../../data/dom-processor/iframe-with-nonproceed-on-server-tags.html');

    return createTestIframe({ src: src })
        .then(function (iframe) {
            var processedAnchor           = iframe.contentDocument.querySelector('#processed-anchor');
            var processedForm             = iframe.contentDocument.querySelector('#processed-form');
            var processedInput            = iframe.contentDocument.querySelector('#processed-input');
            var processedButton           = iframe.contentDocument.querySelector('#processed-button');
            var processedAnchorHref       = nativeMethods.anchorHrefGetter.call(processedAnchor);
            var processedFormAction       = nativeMethods.formActionGetter.call(processedForm);
            var processedInputFormAction  = nativeMethods.inputFormActionGetter.call(processedInput);
            var processedButtonFormAction = nativeMethods.buttonFormActionGetter.call(processedButton);

            strictEqual(processedAnchorHref, urlUtils.getProxyUrl('http://localhost/anchor-action.html'));
            strictEqual(processedFormAction, urlUtils.getProxyUrl('http://localhost/form-action.html', { resourceType: 'f' }));
            strictEqual(processedInputFormAction, urlUtils.getProxyUrl('http://localhost/input-formAction.html', { resourceType: 'f' }));
            strictEqual(processedButtonFormAction, urlUtils.getProxyUrl('http://localhost/button-formAction.html', { resourceType: 'f' }));

            // NOTE: These tags shouldn't be reprocessed on the client side
            // because they are already processed on the server
            var nonProcessedAnchor           = iframe.contentDocument.querySelector('#non-processed-anchor');
            var nonProcessedForm             = iframe.contentDocument.querySelector('#non-processed-form');
            var nonProcessedInput            = iframe.contentDocument.querySelector('#non-processed-input');
            var nonProcessedButton           = iframe.contentDocument.querySelector('#non-processed-button');
            var nonProcessedAnchorHref       = nativeMethods.anchorHrefGetter.call(nonProcessedAnchor);
            var nonProcessedFormAction       = nonProcessedForm.action;
            var nonProcessedInputFormAction  = nonProcessedInput.formAction;
            var nonProcessedButtonFormAction = nonProcessedButton.formAction;

            strictEqual(nonProcessedAnchorHref, 'http://localhost/anchor-action.html');
            strictEqual(nonProcessedFormAction, 'http://localhost/form-action.html');
            strictEqual(nonProcessedInputFormAction, 'http://localhost/input-formAction.html');
            strictEqual(nonProcessedButtonFormAction, 'http://localhost/button-formAction.html');
        });
});

test('the `formaction` attribute should not be overridden if it is missed (GH-1021)', function () {
    var form  = document.createElement('form');
    var input = document.createElement('input');

    form.action = 'http://domain.com/path/';
    form.appendChild(input);

    strictEqual(nativeMethods.getAttribute.call(input, 'formaction'), null);
    strictEqual(nativeMethods.getAttribute.call(input, DomProcessor.getStoredAttrName('formaction')), null);
});

test('`querySelectorAll` should work with :hover pseudoclass:', function () {
    var div = document.createElement('div');

    nativeMethods.appendChild.call(document.body, div);

    eventSimulator.mouseover(div);

    strictEqual(document.querySelectorAll(':hover').length, 3);
    strictEqual(document.querySelectorAll('html :hover').length, 2);
    strictEqual(document.querySelectorAll('body :hover').length, 1);
    strictEqual(document.querySelectorAll('div:hover').length, 1);
    strictEqual(document.querySelectorAll('div :hover').length, 0);

    div.parentNode.removeChild(div);
});
