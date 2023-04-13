var INTERNAL_PROPS          = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_props;
var processHtml             = hammerhead.utils.html.processHtml;
var scriptProcessingHeaders = hammerhead.utils.processing.header;
var styleProcessor          = hammerhead.processors.styleProcessor;
var scriptProcessor         = hammerhead.utils.processing.script;
var urlUtils                = hammerhead.utils.url;
var DomProcessor            = hammerhead.processors.DomProcessor;

var nativeMethods = hammerhead.nativeMethods;

test('clean up outerHTML', function () {
    var htmlText = '<a href="http://domain.com/">link</a>';
    var div      = document.createElement('div');

    div.innerHTML = htmlText;

    var anchor = div.firstChild;

    strictEqual(nativeMethods.elementOuterHTMLGetter.call(anchor), processHtml(htmlText));
    strictEqual(anchor.outerHTML, htmlText);
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

    div.innerHTML = '<style>.rule { background: url(http://domain.com) }</style>';

    check(nativeMethods.elementInnerHTMLGetter.call(div.firstChild));

    div.innerHTML = div.innerHTML; /* eslint-disable-line no-self-assign */

    check(nativeMethods.elementInnerHTMLGetter.call(div.firstChild));

    style.innerHTML = '.rule { background: url(http://domain.com) }';

    check(nativeMethods.elementInnerHTMLGetter.call(style));

    style.innerHTML = style.innerHTML; /* eslint-disable-line no-self-assign */

    check(nativeMethods.elementInnerHTMLGetter.call(style));
});

test('script.<innerHTML/innerText/text/textContent>', function () {
    var script                    = document.createElement('script');
    var scriptText                = 'var test = window.href';
    var processedScriptText       = scriptProcessor.processScript(scriptText, true).replace(/\s/g, '');
    var scriptWithImport          = 'import foo from "foo.js"; import("bar.js").then(() => {});';
    var processedScriptWithImport = scriptProcessor.processScript(scriptWithImport, true, false, urlUtils.convertToProxyUrl).replace(/\s/g, '');
    var testProperties      = {
        'innerHTML': {
            getter: nativeMethods.elementInnerHTMLGetter,
            setter: nativeMethods.elementInnerHTMLSetter,
        },

        'innerText': {
            getter: nativeMethods.htmlElementInnerTextGetter,
            setter: nativeMethods.htmlElementInnerTextSetter,
        },

        'text': {
            getter: nativeMethods.scriptTextGetter,
            setter: nativeMethods.scriptTextSetter,
        },

        'textContent': {
            getter: nativeMethods.nodeTextContentGetter,
            setter: nativeMethods.nodeTextContentSetter,
        },
    };

    Object.keys(testProperties).forEach(function (property) {
        var nativeGetter = testProperties[property].getter;
        var nativeSetter = testProperties[property].setter;

        script[property] = scriptText;

        strictEqual(nativeGetter.call(script).replace(/\s/g, ''), processedScriptText);

        script[property] = '';

        strictEqual(nativeGetter.call(script).replace(/\s/g, ''), '');

        script[property] = { a: 1 };

        strictEqual(nativeGetter.call(script), '[object Object]');

        nativeSetter.call(script, null);

        var expectedValueForNull = nativeGetter.call(script);

        script[property] = null;

        strictEqual(nativeGetter.call(script), expectedValueForNull);

        nativeSetter.call(script, void 0);

        var expectedValueForUndefined = nativeGetter.call(script);

        script[property] = void 0;

        strictEqual(nativeGetter.call(script), expectedValueForUndefined);

        script[property] = scriptWithImport;

        strictEqual(nativeGetter.call(script).replace(/\s/g, ''), processedScriptWithImport);
    });
});

test('style.<innerHTML/innerText/textContent>', function () {
    var style              = document.createElement('style');
    var styleText          = 'div {background:url(http://some.domain.com/image.png)}';
    var processedStyleText = styleProcessor.process(styleText, urlUtils.getProxyUrl, true).replace(/\s/g, '');
    var testProperties     = {
        'innerHTML':   nativeMethods.elementInnerHTMLGetter,
        'innerText':   nativeMethods.htmlElementInnerTextGetter,
        'textContent': nativeMethods.nodeTextContentGetter,
    };

    Object.keys(testProperties).forEach(function (property) {
        var nativeGetter = testProperties[property];

        style[property] = styleText;

        strictEqual(nativeGetter.call(style).replace(/\s/g, ''), processedStyleText);

        style[property] = '';

        strictEqual(nativeGetter.call(style).replace(/\s/g, ''), '');
    });
});

test('body.innerHTML in iframe', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/code-instrumentation/iframe.html') })
        .then(function (iframe) {
            var hasShadowUIRoot = function () {
                var iframeBody               = iframe.contentDocument.body;
                var bodyChildrenOriginLength = nativeMethods.htmlCollectionLengthGetter.call(iframeBody.children);
                var root                     = iframeBody.children[bodyChildrenOriginLength - 1];

                return root && root.id.indexOf('root-') === 0;
            };

            ok(hasShadowUIRoot());

            iframe.contentDocument.body.innerHTML = '';

            return window.QUnitGlobals.wait(hasShadowUIRoot);
        });
});

test('innerHTML', function () {
    var div       = document.createElement('div');
    var scriptUrl = 'http://some.com/script.js';
    var linkUrl   = 'http://some.com/page';

    document[INTERNAL_PROPS.documentCharset] = 'utf-8';

    div.innerHTML = '<script src="' + scriptUrl + '"><' + '/script><a href="' + linkUrl + '"></a>';

    strictEqual(div.children.length, 2);
    strictEqual(nativeMethods.scriptSrcGetter.call(div.firstChild), urlUtils.getProxyUrl(scriptUrl, {
        resourceType: 's',
        charset:      'utf-8',
    }));
    strictEqual(nativeMethods.anchorHrefGetter.call(div.lastChild), urlUtils.getProxyUrl(linkUrl));

    document[INTERNAL_PROPS.documentCharset] = null;
});

test('script text', function () {
    var script = document.createElement('script');

    script.text = 'var test = window.href;';
    ok(scriptProcessor.isScriptProcessed(script.text));
});

test('outerHTML', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = document.createElement('div');
    var htmlText  = '<a href="http://domain.com/">link</a><script src="http://domain.com/script"><' + '/script>';
    var obj       = { b: 1 };

    parentDiv.appendChild(childDiv);

    strictEqual(parentDiv.children.length, 1);
    strictEqual(parentDiv.firstChild, childDiv);

    childDiv.outerHTML = htmlText;

    strictEqual(parentDiv.children.length, 2);
    strictEqual(nativeMethods.anchorHrefGetter.call(parentDiv.firstChild), urlUtils.getProxyUrl('http://domain.com/'));
    strictEqual(nativeMethods.scriptSrcGetter.call(parentDiv.lastChild), urlUtils.getProxyUrl('http://domain.com/script', { resourceType: 's' }));

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    childDiv.outerHTML = obj;

    strictEqual(parentDiv.innerHTML, '[object Object]');

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    childDiv.outerHTML = null;

    var propertyValue = nativeMethods.elementInnerHTMLGetter.call(parentDiv);

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    nativeMethods.elementOuterHTMLSetter.call(childDiv, null);

    strictEqual(propertyValue, nativeMethods.elementInnerHTMLGetter.call(parentDiv));

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    childDiv.outerHTML = void 0;
    propertyValue      = nativeMethods.elementInnerHTMLGetter.call(parentDiv);

    parentDiv.innerHTML = '';
    parentDiv.appendChild(childDiv);

    nativeMethods.elementOuterHTMLSetter.call(childDiv, void 0);

    strictEqual(propertyValue, nativeMethods.elementInnerHTMLGetter.call(parentDiv));
});

test('get style body', function () {
    var style     = document.createElement('style');
    var styleText = 'div{background:url(http://some.domain.com/image.png)}';

    style.innerHTML = styleText;

    strictEqual(style.innerHTML, styleText);
    strictEqual(style.innerText.replace(/\s/g, ''), styleText);
    strictEqual(style.textContent, styleText);
});

module('regression');

test('innerHTML in iframe (GH-620)', function () {
    var url      = 'somePage.html';
    var proxyUrl = urlUtils.getProxyUrl(url, { resourceType: 'i' });

    return createTestIframe()
        .then(function (iframe) {
            iframe.contentDocument.body.innerHTML = '<a href=' + url + '>link</a>';

            strictEqual(nativeMethods.anchorHrefGetter.call(iframe.contentDocument.body.firstChild), proxyUrl);
        });
});

test('script block inserted via element.innerHtml must not be executed (B237015)', function () {
    var testPropertyName = 'testProperty';
    var el               = document.createElement('div');
    var body             = document.getElementsByTagName('body')[0];
    var script           = '<script>window.' + testPropertyName + ' = true;<' + '/script>';

    body.appendChild(el);
    nativeMethods.elementInnerHTMLSetter.call(el, script);

    ok(!window[testPropertyName]);
});

test('iframe.body.innerHtml must be overriden (Q527555)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeBody = iframe.contentWindow.document.body;
            var html       = '<a href="url" ' + DomProcessor.getStoredAttrName('src') + '="url1" />';

            nativeMethods.elementInnerHTMLSetter.call(iframeBody, html);

            ok(iframeBody.innerHTML !== html);
        });
});

test('script.innerHtml must be cleaned up (T226885)', function () {
    var code   = 'var t = 1;';
    var script = document.createElement('script');

    script.appendChild(document.createTextNode(code));
    notEqual(nativeMethods.elementInnerHTMLGetter.call(script).replace(/^\s*|\s*$/g, ''), code);
    strictEqual(script.innerHTML.replace(/^\s*|\s*$/g, ''), code);
});

test('we should clean up hammerhead script and style for all elements (GH-1079)', function () {
    var head         = document.head;
    var style        = document.createElement('style');
    var styleText    = 'div{background:url(http://some.domain.com/image.png)}';
    var firstScript  = document.createElement('script');
    var secondScript = document.createElement('script');
    var scriptCode   = 'var test = window.href;';

    style.textContent = styleText;
    head.appendChild(style);

    firstScript.textContent = scriptCode;
    head.appendChild(firstScript);

    secondScript.textContent = scriptCode;
    head.appendChild(secondScript);

    var checkProperty = function (text) {
        return text.indexOf(scriptProcessingHeaders.SCRIPT_PROCESSING_START_COMMENT) === -1 &&
               text.indexOf(scriptProcessingHeaders.SCRIPT_PROCESSING_END_COMMENT) === -1 &&
               text.indexOf(scriptProcessingHeaders.SCRIPT_PROCESSING_END_HEADER_COMMENT) === -1 &&
               text.indexOf(styleProcessor.STYLESHEET_PROCESSING_START_COMMENT) === -1 &&
               text.indexOf(styleProcessor.STYLESHEET_PROCESSING_END_COMMENT) === -1;
    };

    ok(checkProperty(firstScript.text || ''), 'text');
    ok(checkProperty(head.textContent), 'textContent');
    ok(checkProperty(head.innerText || ''), 'innerText');
    ok(checkProperty(head.innerHTML), 'innerHTML');
    ok(checkProperty(head.outerHTML), 'outerHTML');

    head.removeChild(style);
    head.removeChild(firstScript);
    head.removeChild(secondScript);
});

test('we should clean up html and remove extra namespaces from svg (GH-1083)', function () {
    var svg           = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var anchor        = document.createElement('a');
    var div           = document.createElement('div');
    var defs          = document.createElement('defs');
    var feImage       = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
    var use           = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    var nativeSvg     = nativeMethods.createElementNS.call(document, 'http://www.w3.org/2000/svg', 'svg');
    var nativeAnchor  = nativeMethods.createElement.call(document, 'a');
    var nativeDiv     = nativeMethods.createElement.call(document, 'div');
    var nativeDefs    = nativeMethods.createElement.call(document, 'defs');
    var nativeFeImage = nativeMethods.createElementNS.call(document, 'http://www.w3.org/2000/svg', 'feImage');
    var nativeUse     = nativeMethods.createElementNS.call(document, 'http://www.w3.org/2000/svg', 'use');

    anchor.setAttribute('href', '/path');
    nativeMethods.setAttribute.call(nativeAnchor, 'href', '/path');

    anchor.innerText = nativeAnchor.innerHTML = 'link';

    feImage.setAttribute('href', '/path');
    nativeMethods.setAttribute.call(nativeFeImage, 'href', '/path');

    use.setAttribute('href', '/path');
    nativeMethods.setAttribute.call(nativeUse, 'href', '/path');

    defs.appendChild(feImage);
    nativeMethods.appendChild.call(nativeDefs, nativeFeImage);

    svg.appendChild(anchor);
    nativeMethods.appendChild.call(nativeSvg, nativeAnchor);

    svg.appendChild(defs);
    nativeMethods.appendChild.call(nativeSvg, nativeDefs);

    svg.appendChild(use);
    nativeMethods.appendChild.call(nativeSvg, nativeUse);

    div.appendChild(svg);
    nativeMethods.appendChild.call(nativeDiv, nativeSvg);

    strictEqual(div.innerHTML, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));

    div.innerHTML = nativeDiv.innerHTML = '';

    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    nativeMethods.setAttribute.call(nativeSvg, 'xmlns:xlink', 'http://www.w3.org/1999/xlink');

    div.appendChild(svg.cloneNode(true));
    nativeMethods.appendChild.call(nativeDiv, nativeMethods.cloneNode.call(nativeSvg, true));

    strictEqual(div.innerHTML, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));

    nativeMethods.elementInnerHTMLSetter.call(div, nativeMethods.elementInnerHTMLGetter.call(div));
    nativeMethods.elementInnerHTMLSetter.call(nativeDiv, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));

    div.appendChild(svg);
    nativeMethods.appendChild.call(nativeDiv, nativeSvg);

    strictEqual(div.innerHTML, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));
});

test('leaving attributes, that are used in non-standard way, as they are (GH-TC-2347)', function () {
    var htmlText = '<input action="#test-me-out">';
    var div      = document.createElement('div');

    div.innerHTML = htmlText;

    var input = div.firstChild;

    strictEqual(nativeMethods.elementOuterHTMLGetter.call(input), processHtml(htmlText));
    strictEqual(input.outerHTML, htmlText);
});
