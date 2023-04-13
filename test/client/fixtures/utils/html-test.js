var INTERNAL_ATTRS = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_attributes;
var DomProcessor   = hammerhead.processors.DomProcessor;
var domProcessor   = hammerhead.processors.domProcessor;
var htmlUtils      = hammerhead.utils.html;
var processScript  = hammerhead.utils.processing.script.processScript;
var urlUtils       = hammerhead.utils.url;
var urlResolver    = hammerhead.utils.urlResolver;

var SELF_REMOVING_SCRIPTS = hammerhead.sharedUtils.selfRemovingScripts;

var nativeMethods = hammerhead.nativeMethods;
var shadowUI      = hammerhead.sandbox.shadowUI;

module('clean up html');

test('hover marker', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;

    urlUtils.overrideGetProxyUrl(function (url) {
        return url + '_proxy';
    });

    var html = '<a href="http://domain.com"></a>' +
               '<div ' + INTERNAL_ATTRS.hoverPseudoClass + '></div>' +
               '<div ' + INTERNAL_ATTRS.hoverPseudoClass + '=""></div>';

    var expected      = '<a href="http://domain.com"></a><div></div><div></div>';
    var processedHtml = htmlUtils.processHtml(html);

    strictEqual(htmlUtils.cleanUpHtml(processedHtml), expected);

    urlUtils.overrideGetProxyUrl(storedGetProxyUrl);
});

test('focus marker', function () {
    var html = '<input ' + INTERNAL_ATTRS.focusPseudoClass + '>' +
               '<input ' + INTERNAL_ATTRS.focusPseudoClass + '="">';

    strictEqual(htmlUtils.cleanUpHtml(html), '<input><input>');
});

test('autocomplete attribute', function () {
    var html = '<input ' + DomProcessor.getStoredAttrName('autocomplete') +
               '="' + domProcessor.AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER + '" autocomplete="off">' +
               '<input ' + DomProcessor.getStoredAttrName('autocomplete') + '="on" autocomplete="off">';

    strictEqual(htmlUtils.cleanUpHtml(html), '<input><input autocomplete="on">');
});

test('shadow ui elements', function () {
    var uiElem = document.createElement('div');

    uiElem.id = 'uiElem';

    shadowUI.addClass(uiElem, 'ui-elem-class');

    var el = document.createElement('div');

    el.appendChild(uiElem);

    var shadowUIElemHtml = nativeMethods.elementInnerHTMLGetter.call(el);
    var html             = '<head>' + shadowUIElemHtml + '</head><body>' + shadowUIElemHtml + '</body>';

    strictEqual(htmlUtils.cleanUpHtml(html), '<head></head><body></body>');
});

test('attribute with a special proxying logic (GH-1448)', function () {
    var div = document.createElement('div');

    div.setAttribute('style', 'color: black;');

    var expectedOuterHtml = '<div style="color: black;"></div>';

    strictEqual(div.outerHTML, expectedOuterHtml);
});

test('form', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;

    urlUtils.overrideGetProxyUrl(function (url) {
        return url + '_proxy';
    });

    var url          = 'http://domain.com';
    var pocessedHtml = '<form action="' + urlUtils.getProxyUrl(url) + '" ' +
                       DomProcessor.getStoredAttrName('action') + '="' + url + '"></form>';
    var expexted     = '<form action="http://domain.com"></form>';

    strictEqual(htmlUtils.cleanUpHtml(pocessedHtml), expexted);

    urlUtils.overrideGetProxyUrl(storedGetProxyUrl);
});

module('process html');

test('iframe', function () {
    var processedHtml = htmlUtils.processHtml('<iframe src="https://example.com/">');

    ok(processedHtml.indexOf('sessionId!i/https://example.com/"') !== -1);
});

test('element with error in attribute', function () {
    var destUrl      = 'http://example.com/';
    var src          = '<script data-src="' + destUrl + '"><' + '/script>';
    var processedSrc = src;

    src = htmlUtils.processHtml(src);

    strictEqual(src, processedSrc);
});

test('encoded symbols', function () {
    var div            = document.createElement('div');
    var tag            = 'a';
    var attr           = 'href';
    var storedAttr     = DomProcessor.getStoredAttrName(attr);
    var urlEncoded     = 'http://example.com/?x=&lt;&y=5';
    var urlDecoded     = 'http://example.com/?x=<&y=5';
    var divForEncoding = document.createElement('div');

    divForEncoding.textContent = urlUtils.getProxyUrl(urlDecoded);

    var proxyEncoded  = nativeMethods.elementInnerHTMLGetter.call(divForEncoding);
    var html          = '<' + tag + ' ' + attr + '="' + urlEncoded + '"></' + tag + '>';
    var processedHTML = '<' + tag + ' ' + attr + '="' + proxyEncoded + '" ' + storedAttr + '="' + urlEncoded + '"></' +
                        tag + '>';

    nativeMethods.elementInnerHTMLSetter.call(div, htmlUtils.processHtml(html) + processedHTML);

    strictEqual(nativeMethods.getAttribute.call(div.firstChild, attr), nativeMethods.getAttribute.call(div.lastChild, attr));
    strictEqual(nativeMethods.getAttribute.call(div.firstChild, storedAttr), nativeMethods.getAttribute.call(div.lastChild, storedAttr));
});

test('text node', function () {
    var error = false;

    window.onerror = function () {
        error = true;
    };

    htmlUtils.processHtml('some text', { parentTag: 'div' });

    ok(!error);
});

test('html fragment', function () {
    var htmlToProcess     = '<a href="//example.com">Link</a>';
    var processedHTML     = '<a href="' + urlUtils.getProxyUrl('//example.com') + '" ' + DomProcessor.getStoredAttrName('href') +
                            '="//example.com">Link</a>';

    var checkFragment = function (html, parentTag) {
        var src      = html.replace('%s', htmlToProcess);
        var expected = html.replace('%s', processedHTML);

        strictEqual(htmlUtils.processHtml(src, { parentTag: parentTag }).replace(/\s/g, ''), expected.replace(/\s/g, ''));
    };

    checkFragment('<td>%s</td><td>Content</td>', 'tr');
    checkFragment('<td>Content1</td><td>Content2</td>', 'tr');
    checkFragment('<tr><td>%s</td><td>Content</td></tr>', 'table');
    checkFragment('<tr><td>Content1</td><td>Content2</td></tr>', 'table');
    checkFragment('%s', 'html');
    checkFragment('<div>Content</div>', 'html');
});

test('text nodes', function () {
    var hoverAttr = INTERNAL_ATTRS.hoverPseudoClass;

    var check = function (html) {
        var processedHtml = htmlUtils.cleanUpHtml('<div ' + hoverAttr + '="">' + html + '</div>');

        strictEqual(processedHtml, '<div>' + html + '</div>');
    };

    check('<table> \n\t <tfoot>textNode</tfoot><tbody> \n\t <tr> \n\t </tr></tbody></table>');
    check('<table> textNode' +
          '<thead>textNode</thead>textNode' +
          '<tfoot>textNode</tfoot>textNode' +
          '<tbody>textNode' +
          '<tr>textNode' +
          '<td>textNode</td>textNode' +
          '</tr>textNode' +
          '</tbody>textNode' +
          '</table>');
    check('<!--<h4>New Job</h4>-->' +
          '<!--<table>-->' +
          '<!--    <tr>-->' +
          '<!--        <td>Customer:</td>-->' +
          '<!--        <td>-->');
    check('<table>' +
          '  <colgroup>' +
          '    <col></col>' +
          '    <col/>' +
          '    <col style="background-color: red;" span="2" />' +
          '  </colgroup>' +
          '  <tr><td></td></tr>' +
          '</table>');
});

test('page html', function () {
    var storedConvertToProxyUrl = urlUtils.convertToProxyUrl;

    urlUtils.overrideConvertToProxyUrl(function (url) {
        return 'replaced' + url;
    });

    var check = function (html) {
        var processedHtml = htmlUtils.processHtml(html);

        ok(processedHtml.indexOf('replacedBodyScript.js') !== -1);
        ok(processedHtml.indexOf('replacedHeadScript.js') !== -1);
        strictEqual(html.toLowerCase(), htmlUtils.cleanUpHtml(processedHtml).toLowerCase());
    };

    check('<!DOCTYPE html><html><head><script src="HeadScript.js"><' + '/script></head><body><script src="BodyScript.js"><' + '/script></body></html>');
    check('<html><head><script src="HeadScript.js"><' + '/script></head><body><script src="BodyScript.js"><' + '/script></body></html>');
    check('<head><script src="HeadScript.js"><' + '/script></head><body><script src="BodyScript.js"><' + '/script></body>');
    check('<head><script src="HeadScript.js"><' + '/script><script src="BodyScript.js"><' + '/script></head>');
    check('<body><script src="HeadScript.js"><' + '/script><script src="BodyScript.js"><' + '/script></body>');
    check('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
          '<html><head><script src="HeadScript.js"><' + '/script></head><body>\u2028\u2029<script src="BodyScript.js"><' + '/script></body></html>');
    check('<html><head><script src="HeadScript.js"><' + '/script></head><body>\u2028\u2029<script src="BodyScript.js"><' + '/script></body></html>');
    check('<head param="value"><script src="HeadScript.js"><' + '/script></head><body>\u2028\u2029<script src="BodyScript.js"><' + '/script></body>');
    check('<head>\u2028\u2029<script src="HeadScript.js"><' + '/script></head><body param="value"><script src="BodyScript.js"><' + '/script></body>');
    check('<body><script src="HeadScript.js"><' + '/script>\u2028\u2029<script src="BodyScript.js"><' + '/script></body>');
    check('<body><script src="HeadScript.js"><' + '/script>\u2028\u2029<script src="BodyScript.js"><' + '/script></body>');

    urlUtils.overrideConvertToProxyUrl(storedConvertToProxyUrl);
});

test('noscript tag', function () {
    var html = '<noscript><div></noscript> <span></span> <noscript></div></noscript>';

    strictEqual(htmlUtils.processHtml(html), html);
});

test('partial page html', function () {
    strictEqual(htmlUtils.cleanUpHtml(htmlUtils.processHtml('<!doctype html><html><head></head><body>')),
        '<!doctype html><html><head></head><body></body></html>');

    strictEqual(htmlUtils.cleanUpHtml(htmlUtils.processHtml('<html><head></head><body>')),
        '<html><head></head><body></body></html>');
});

test('init script for iframe template', function () {
    var check = function (template) {
        var html                  = template.replace(/\{0\}/g, '');
        var expectedProcessedHtml = template.replace(/\{0\}/g, SELF_REMOVING_SCRIPTS.iframeInit);
        var processedHtml         = htmlUtils.processHtml(html);

        strictEqual(processedHtml, expectedProcessedHtml);
        strictEqual(htmlUtils.cleanUpHtml(processedHtml), html);
    };

    check('<!doctype><html><head>{0}</head><body>{0}</body></html>');
    check('<html><head>{0}</head><body>{0}</body></html>');
    check('<head>{0}</head>');
    check('<body>{0}</body>');
});

test('script with the "module" type', function () {
    var div        = document.createElement('div');
    var scriptText = 'var a = 5;';

    div.innerHTML = '<script type="module">' + scriptText + '<' + '/script>';

    strictEqual(nativeMethods.nodeTextContentGetter.call(div.firstChild), processScript(scriptText, true));
});

test('script with the import keyword', function () {
    var div        = document.createElement('div');
    var scriptText = 'import foo from "foo.js";' +
                     'import("bar.js").then(m => {})';

    div.innerHTML = '<script type="module">' + scriptText + '<' + '/script>';

    strictEqual(nativeMethods.nodeTextContentGetter.call(div.firstChild), processScript(scriptText, true, false, urlUtils.convertToProxyUrl));
});

module('regression');

test('markup with special characters must be cleaned up (T112153)', function () {
    var html =
            '<h3 class="time">#: Time#</h3><h3>#: From #</h3>\n' +
            '<a class="reply"\n' +
            'data-role="button"\n' +
            'data-rel="actionsheet"\n' +
            'href="\\\\#inboxActions"\n' +
            'data-actionsheet-context="#:ID#">Reply</a>\n' +
            '<h2>#: Subject#</h2>\n' +
            '<p>#: Text#</p>';

    strictEqual(htmlUtils.cleanUpHtml(html).replace(/\s/g, ''), html.replace(/\s/g, ''));
});

test('html and body attributes must be processed (T226655)', function () {
    var attrValue           = 'document.location = \'http://example.com/\'';
    var expectedAttrValue   = processScript(attrValue, false).replace(/\s/g, '');
    var htmlWithBody        = '<body onblur="' + attrValue + '">';
    var htmlWithHeadAndBody = '<head></head><body onblur="' + attrValue + '"></body>';
    var htmlWithHtmlTag     = '<html onblur="' + attrValue + '">';

    ok(htmlUtils.processHtml(htmlWithBody).replace(/\s/g, '').replace(/&quot;/ig, '"').indexOf(expectedAttrValue) !==
       -1);
    ok(htmlUtils.processHtml(htmlWithHeadAndBody).replace(/\s/g, '').replace(/&quot;/ig, '"').indexOf(expectedAttrValue) !==
       -1);
    ok(htmlUtils.processHtml(htmlWithHtmlTag).replace(/\s/g, '').replace(/&quot;/ig, '"').indexOf(expectedAttrValue) !==
       -1);
});

test('html with special script is processed correctly (GH-684)', function () {
    var htmlSrc = [
        '<script>',
        // NOTE: We need some kind of table tags in js code e.g. <th .length, y = 3 >
        // That's because the 'fake_tag_name_' prefix is added to some tags during html processing, e.g. <fake_tag_name_th .length, y = 3 >
        '    var x = y <th .length, y = 3 > 5;',
        '<' + '/script>',
    ].join('\n');

    var htmlExpected = [
        '<script>',
        processScript('\n    var x = y <th .length, y = 3 > 5;\n', true),
        '<' + '/script>',
    ].join('');

    strictEqual(htmlUtils.processHtml(htmlSrc), htmlExpected);
});

test('process html with an unclosed "p" tag and the "header" tag (GH-688)', function () {
    var div = document.createElement('div');

    nativeMethods.elementInnerHTMLSetter.call(div, '<p><header></header>');

    strictEqual(htmlUtils.processHtml('<p><header></header>'), nativeMethods.elementInnerHTMLGetter.call(div));
});

test('get a proxy url from a relative url after html processing (GH-718)', function () {
    urlResolver.updateBase('http://example.com/path/path/', document);
    htmlUtils.processHtml('<div></div>');
    strictEqual(urlUtils.getProxyUrl('index.html', {
        proxyHostname: '127.0.0.1',
        proxyPort:     1337,
        sessionId:     'sessionId',
    }), 'http://127.0.0.1:1337/sessionId/http://example.com/path/path/index.html');
    urlResolver.updateBase(null, document);
});

test('should not throw an error if the innerHTML property is defined on Node.prototype (GH-1538)', function () {
    Object.defineProperty(Node.prototype, 'innerHTML', {
        set: function () {
            throw new Error();
        },

        configurable: true,
    });

    try {
        document.createElement('div').innerHTML = 'html';
        ok(true);
    }
    catch (e) {
        ok(false);
    }
    finally {
        delete Node.prototype.innerHTML;
    }
});
