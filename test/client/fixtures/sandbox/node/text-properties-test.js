var INTERNAL_PROPS          = hammerhead.get('../processing/dom/internal-properties');
var processHtml             = hammerhead.get('../client/utils/html').processHtml;
var scriptProcessingHeaders = hammerhead.get('../processing/script/header');
var styleProcessor          = hammerhead.get('../processing/style');
var scriptProcessor         = hammerhead.get('../processing/script');
var urlUtils                = hammerhead.get('./utils/url');
var DomProcessor            = hammerhead.get('../processing/dom');

var nativeMethods = hammerhead.nativeMethods;

test('clean up outerHTML', function () {
    var htmlText = '<a href="http://domain.com/">link</a>';
    var div      = document.createElement('div');

    div.innerHTML = htmlText;

    var anchor = div.firstChild;

    strictEqual(nativeMethods.elementOuterHTMLGetter.call(anchor), processHtml(htmlText));
    strictEqual(anchor.outerHTML, htmlText);
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
    var svg          = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var anchor       = document.createElement('a');
    var div          = document.createElement('div');
    var nativeSvg    = nativeMethods.createElementNS.call(document, 'http://www.w3.org/2000/svg', 'svg');
    var nativeAnchor = nativeMethods.createElement.call(document, 'a');
    var nativeDiv    = nativeMethods.createElement.call(document, 'div');

    anchor.setAttribute('href', '/path');
    nativeMethods.setAttribute.call(nativeAnchor, 'href', '/path');

    anchor.innerText = nativeAnchor.innerHTML = 'link';

    svg.appendChild(anchor);
    nativeMethods.appendChild.call(nativeSvg, nativeAnchor);

    div.appendChild(svg);
    nativeMethods.appendChild.call(nativeDiv, nativeSvg);

    strictEqual(div.innerHTML, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));

    div.innerHTML = nativeDiv.innerHTML = '';

    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    nativeMethods.setAttribute.call(nativeSvg, 'xmlns:xlink', 'http://www.w3.org/1999/xlink');

    div.appendChild(svg.cloneNode(true));
    nativeMethods.appendChild.call(nativeDiv, nativeMethods.cloneNode.call(nativeSvg, true));

    strictEqual(div.innerHTML, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));

    // NOTE: IE added additional attributes with namespaces
    // such as 'xmlns:NS2=""', NS2:xmlns:ns1=""
    // after setting div.innerHTML property
    nativeMethods.elementInnerHTMLSetter.call(div, nativeMethods.elementInnerHTMLGetter.call(div));
    nativeMethods.elementInnerHTMLSetter.call(nativeDiv, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));

    div.appendChild(svg);
    nativeMethods.appendChild.call(nativeDiv, nativeSvg);

    strictEqual(div.innerHTML, nativeMethods.elementInnerHTMLGetter.call(nativeDiv));
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

    div.innerHTML = div.innerHTML;

    check(nativeMethods.elementInnerHTMLGetter.call(div.firstChild));

    style.innerHTML = '.rule { background: url(http://domain.com) }';

    check(nativeMethods.elementInnerHTMLGetter.call(style));

    style.innerHTML = style.innerHTML;

    check(nativeMethods.elementInnerHTMLGetter.call(style));
});

QUnit.skip('innerHTML, innerText, text, textContent', function () {
    var script              = document.createElement('script');
    var style               = document.createElement('style');
    var scriptText          = 'var test = window.href';
    var styleText           = 'div {background:url(http://some.domain.com/image.png)}';
    var processedScriptText = scriptProcessor.processScript(scriptText, true).replace(/\s/g, '');
    var processedStyleText  = styleProcessor.process(styleText, urlUtils.getProxyUrl, true).replace(/\s/g, '');
    var testProperties      = ['innerHTML', 'innerText', 'text', 'textContent'];

    testProperties.forEach(function (property) {
        script[property] = scriptText;

        strictEqual(script[property].replace(/\s/g, ''), processedScriptText); // ???

        script[property] = '';

        strictEqual(script[property], ''); // ???
    });

    testProperties.forEach(function (property) {
        style[property] = styleText;

        // NOTE: text property is not supported for style element
        if (property === 'text')
            strictEqual(style[property], styleText);
        else
            strictEqual(style[property].replace(/\s/g, ''), processedStyleText);// ???

        style[property] = '';

        strictEqual(style[property], '');// ???
    });

    testProperties.forEach(function (property) {
        script[property] = { a: 1 };

        strictEqual(script[property], '[object Object]');// ???
    });

    testProperties.forEach(function (property) {
        script[property] = null;

        var propertyValue = script[property];

        script[property] = null;// ???

        strictEqual(propertyValue, script[property]);// ???
    });

    testProperties.forEach(function (property) {
        script[property] = void 0;

        var propertyValue = script[property];// ???

        script[property] = void 0;// ???

        strictEqual(propertyValue, script[property]);// ???
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
        charset:      'utf-8'
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

QUnit.skip('we should not process element\'s properties if they do not exist (GH-1164)', function () {
    var div            = document.createElement('div');
    var svg            = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var html           = '<a href="/path">link</a>';
    var processedHtml  = processHtml(html);
    var style          = 'body {}';
    var textProperties = ['innerText', 'textContent'];
    var styleElement   = document.createElement('style');

    div.appendChild(svg);

    var svgHasInnerHTML = svg.innerHTML !== void 0;

    strictEqual(getProperty(svg, 'innerHTML'), svg.innerHTML);

    // NOTE: Only MSEdge puts additional 'xmlns' attribute for svg child nodes
    svg.innerHTML = processedHtml;

    var processedHtmlInsideSvg = svg.innerHTML;

    setProperty(svg, 'innerHTML', html);

    strictEqual(svg.innerHTML, svgHasInnerHTML ? processedHtmlInsideSvg : html);

    svg.innerHTML = '';

    var svgHasOuterHTML = svg.outerHTML !== void 0;

    strictEqual(getProperty(svg, 'outerHTML'), svg.outerHTML);

    setProperty(svg, 'outerHTML', html);

    if (svgHasOuterHTML)
        strictEqual(div.innerHTML, processedHtml);
    else
        strictEqual(svg.outerHTML, html);

    setProperty(styleElement, 'innerHTML', style);

    svg.appendChild(styleElement);

    textProperties.forEach(function (property) {
        var svgHasProperty = svg[property] !== void 0;

        strictEqual(getProperty(svg, property), svgHasProperty ? style : void 0, property);
    });
});

test('leaving attributes, that are used in non-standard way, as they are (GH-TC-2347)', function () {
    var htmlText = '<input action="#test-me-out">';
    var div      = document.createElement('div');

    div.innerHTML = htmlText;

    var input = div.firstChild;

    strictEqual(nativeMethods.elementOuterHTMLGetter.call(input), processHtml(htmlText));
    strictEqual(input.outerHTML, htmlText);
});

test('get style body', function () {
    var style     = document.createElement('style');
    var styleText = 'div{background:url(http://some.domain.com/image.png)}';

    style.innerHTML = styleText;

    strictEqual(style.innerHTML, styleText);
    strictEqual(style.innerText.replace(/\s/g, ''), styleText);
    strictEqual(style.textContent, styleText);
});
