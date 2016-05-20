var INTERNAL_ATTRS    = hammerhead.get('../processing/dom/internal-attributes');
var domProcessor      = hammerhead.get('./dom-processor');
var htmlUtils         = hammerhead.get('./utils/html');
var processScript     = hammerhead.get('../processing/script').processScript;
var urlUtils          = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;
var iframeSandbox = hammerhead.sandbox.iframe;
var shadowUI      = hammerhead.sandbox.shadowUI;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

module('clean up html');

test('hover marker', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;

    urlUtils.getProxyUrl = function (url) {
        return url + '_proxy';
    };

    var html = '<a href="http://domain.com"></a>' +
               '<div ' + INTERNAL_ATTRS.hoverPseudoClass + '></div>' +
               '<div ' + INTERNAL_ATTRS.hoverPseudoClass + '=""></div>';

    var expexted     = '<a href="http://domain.com"></a><div></div><div></div>';
    var pocessedHtml = htmlUtils.processHtml(html);

    strictEqual(htmlUtils.cleanUpHtml(pocessedHtml), expexted);

    urlUtils.getProxyUrl = storedGetProxyUrl;
});

test('shadow ui elements', function () {
    var uiElem = document.createElement('div');

    uiElem.id = 'uiElem';

    shadowUI.addClass(uiElem, 'ui-elem-class');

    var el = document.createElement('div');

    el.appendChild(uiElem);

    var html = '<head>' + el.innerHTML + '</head><body>' + el.innerHTML + '</body>';

    strictEqual(htmlUtils.cleanUpHtml(html), '<head></head><body></body>');
});

test('form', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;

    urlUtils.getProxyUrl = function (url) {
        return url + '_proxy';
    };

    var url          = 'http://domain.com';
    var pocessedHtml = '<form action="' + urlUtils.getProxyUrl(url) + '" ' +
                       domProcessor.getStoredAttrName('action') + '="' + url + '"></form>';
    var expexted     = '<form action="http://domain.com"></form>';

    strictEqual(htmlUtils.cleanUpHtml(pocessedHtml), expexted);

    urlUtils.getProxyUrl = storedGetProxyUrl;
});

module('process html');

test('iframe', function () {
    var processedHtml = htmlUtils.processHtml('<iframe src="http://example.com/">');

    ok(processedHtml.indexOf('sessionId!i/http://example.com/"') !== -1);
});

test('element with error in attribute', function () {
    var destUrl      = 'http://example.com/';
    var src          = '<script data-src="' + destUrl + '"></script\>';
    var processedSrc = src;

    src = htmlUtils.processHtml(src);

    strictEqual(src, processedSrc);
});

test('encoded symbols', function () {
    var div            = document.createElement('div');
    var tag            = 'a';
    var attr           = 'href';
    var storedAttr     = domProcessor.getStoredAttrName(attr);
    var urlEncoded     = 'http://example.com/?x=&lt;&y=5';
    var urlDecoded     = 'http://example.com/?x=<&y=5';
    var divForEncoding = document.createElement('div');

    divForEncoding.textContent = urlUtils.getProxyUrl(urlDecoded);

    var proxyEncoded  = divForEncoding.innerHTML;
    var html          = '<' + tag + ' ' + attr + '="' + urlEncoded + '"></' + tag + '>';
    var processedHTML = '<' + tag + ' ' + attr + '="' + proxyEncoded + '" ' + storedAttr + '="' + urlEncoded + '"></' +
                        tag + '>';

    div.innerHTML = htmlUtils.processHtml(html) + processedHTML;

    strictEqual(nativeMethods.getAttribute.call(div.firstChild, attr), nativeMethods.getAttribute.call(div.lastChild, attr));
    strictEqual(nativeMethods.getAttribute.call(div.firstChild, storedAttr), nativeMethods.getAttribute.call(div.lastChild, storedAttr));
});

test('text node', function () {
    var error = false;

    window.onerror = function () {
        error = true;
    };

    htmlUtils.processHtml('some text', 'div');

    ok(!error);
});

test('html fragment', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;
    var htmlToProcess     = $('<a href="www.google.com">Link</a>')[0].innerHTML;
    var processedHTML     = $('<a href="replaced" ' + domProcessor.getStoredAttrName('href') +
                              '="www.google.com">Link</a>')[0].innerHTML;

    urlUtils.getProxyUrl = function () {
        return 'replaced';
    };

    var checkFragment = function (html, parentTag) {
        var src      = html.replace('%s', htmlToProcess);
        var expected = html.replace('%s', processedHTML);

        strictEqual(htmlUtils.processHtml(src, parentTag).replace(/\s/g, ''), expected.replace(/\s/g, ''));
    };

    checkFragment('<td>%s</td><td>Content</td>', 'tr');
    checkFragment('<td>Content1</td><td>Content2</td>', 'tr');
    checkFragment('<tr><td>%s</td><td>Content</td></tr>', 'table');
    checkFragment('<tr><td>Content1</td><td>Content2</td></tr>', 'table');
    checkFragment('%s', 'html');
    checkFragment('<div>Content</div>', 'html');

    urlUtils.getProxyUrl = storedGetProxyUrl;
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
});

test('page html', function () {
    var storedConvertToProxyUrl = urlUtils.convertToProxyUrl;

    urlUtils.convertToProxyUrl = function (url) {
        return 'replaced' + url;
    };

    var check = function (html) {
        var processedHtml = htmlUtils.processHtml(html);

        ok(processedHtml.indexOf('replacedBodyScript.js') !== -1);
        ok(processedHtml.indexOf('replacedHeadScript.js') !== -1);
        strictEqual(html.toLowerCase(), htmlUtils.cleanUpHtml(processedHtml).toLowerCase());
    };

    check('<!DOCTYPE html><html><head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script></body></html>');
    check('<html><head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script></body></html>');
    check('<head><script src="HeadScript.js"><\/script></head><body><script src="BodyScript.js"><\/script></body>');
    check('<head><script src="HeadScript.js"><\/script><script src="BodyScript.js"><\/script></head>');
    check('<body><script src="HeadScript.js"><\/script><script src="BodyScript.js"><\/script></body>');
    check('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
          '<html><head><script src="HeadScript.js"><\/script></head><body>\u2028\u2029<script src="BodyScript.js"><\/script></body></html>');
    check('<html><head><script src="HeadScript.js"><\/script></head><body>\u2028\u2029<script src="BodyScript.js"><\/script></body></html>');
    check('<head param="value"><script src="HeadScript.js"><\/script></head><body>\u2028\u2029<script src="BodyScript.js"><\/script></body>');
    check('<head>\u2028\u2029<script src="HeadScript.js"><\/script></head><body param="value"><script src="BodyScript.js"><\/script></body>');
    check('<body><script src="HeadScript.js"><\/script>\u2028\u2029<script src="BodyScript.js"><\/script></body>');
    check('<body><script src="HeadScript.js"><\/script>\u2028\u2029<script src="BodyScript.js"><\/script></body>');

    urlUtils.convertToProxyUrl = storedConvertToProxyUrl;
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
        var expectedProcessedHtml = template.replace(/\{0\}/g, htmlUtils.INIT_SCRIPT_FOR_IFRAME_TEMPLATE);
        var processedHtml         = htmlUtils.processHtml(html);

        strictEqual(processedHtml, expectedProcessedHtml);
        strictEqual(htmlUtils.cleanUpHtml(processedHtml), html);
    };

    check('<!doctype><html><head>{0}</head><body>{0}</body></html>');
    check('<html><head>{0}</head><body>{0}</body></html>');
    check('<head>{0}</head>');
    check('<body>{0}</body>');
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
    var attrValue           = 'var js = document.createElement(\'script\');js.src = \'http://google.com\'; document.body.appendChild(js);';
    var expectedAttrValue   = processScript(attrValue, false).replace(/\s/g, '');
    var htmlWithBody        = '<body onload="' + attrValue + '">';
    var htmlWithHeadAndBody = '<head></head><body onload="' + attrValue + '"></body>';
    var htmlWithHtmlTag     = '<html onload="' + attrValue + '">';

    ok(htmlUtils.processHtml(htmlWithBody).replace(/\s/g, '').replace(/&quot;/ig, '"').indexOf(expectedAttrValue) !==
       -1);
    ok(htmlUtils.processHtml(htmlWithHeadAndBody).replace(/\s/g, '').replace(/&quot;/ig, '"').indexOf(expectedAttrValue) !==
       -1);
    ok(htmlUtils.processHtml(htmlWithHtmlTag).replace(/\s/g, '').replace(/&quot;/ig, '"').indexOf(expectedAttrValue) !==
       -1);
});

