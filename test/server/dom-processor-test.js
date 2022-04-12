const expect        = require('chai').expect;
const parse5        = require('parse5');
const urlLib        = require('url');
const DomProcessor  = require('../../lib/processing/dom');
const processScript = require('../../lib/processing/script').processScript;
const DomAdapter    = require('../../lib/processing/dom/parse5-dom-adapter');
const urlUtils      = require('../../lib/utils/url');
const parse5Utils   = require('../../lib/utils/parse5');

const domAdapter = new DomAdapter();

const testCrossDomainPort = 1338;
const testProxyHostName   = 'localhost';
const testProxyPort       = 80;


function process (html, isIframe, replacer) {
    const root             = parse5.parse(html);
    const testDomProcessor = new DomProcessor(new DomAdapter(isIframe, testCrossDomainPort));
    const urlReplacer      = replacer || ((resourceUrl, resourceType, charsetAttrValue, isCrossDomain = false) => {
        resourceUrl = urlLib.resolve('http://example.com/', resourceUrl);

        return urlUtils.getProxyUrl(resourceUrl, {
            proxyHostname: testProxyHostName,
            proxyPort:     (isCrossDomain ? testCrossDomainPort : testProxyPort).toString(),
            sessionId:     'sessionId',
            resourceType:  resourceType,
        });
    });

    parse5Utils.walkElements(root, el => testDomProcessor.processElement(el, urlReplacer));

    return root;
}

describe('DOM processor', () => {
    it('Should process elements outside <html></html>', () => {
        const root = process('<html></html><script src="http://example.com/script.js"></script>');

        const script = parse5Utils.findElementsByTagNames(root, 'script').script[0];

        expect(domAdapter.getAttr(script, 'src')).eql('http://localhost:80/sessionId!s/http://example.com/script.js');
    });

    it('Should process sandboxed <iframe>', () => {
        const root = process('<html><head></head><body><iframe sandbox="allow-forms"></iframe></body></html>');

        expect(parse5.serialize(root)).contains('<iframe sandbox="allow-forms allow-same-origin allow-scripts" ' +
                                                DomProcessor.getStoredAttrName('sandbox') + '="allow-forms">');
    });

    it('Should process style attribute', () => {
        const root = process('<div style="background: url(http://example.com/style.css)"></div>');

        expect(parse5.serialize(root)).eql('<html><head></head><body>' +
            '<div style="background: url(http://localhost:80/sessionId/http://example.com/style.css)"></div></body></html>');
    });

    it('Should process <script> src', () => {
        const root = process('<script src="http://example.com/script.js"></script>');

        const script = parse5Utils.findElementsByTagNames(root, 'script').script[0];

        expect(domAdapter.getAttr(script, 'src')).eql('http://localhost:80/sessionId!s/http://example.com/script.js');
    });

    it('Should process <script> with correct type', () => {
        const casesWithCorrectType = [
            'application/x-ecmascript', 'application/x-javascript', 'application/ecmascript', 'application/javascript',
            'text/x-ecmascript', 'text/ecmascript', 'text/x-javascript', 'text/jsscript', 'text/livescript',
            'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2',
            'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', '   text/javascript1.5   ',
        ];

        const casesWithIncorrectType = [
            '123', 'aplication/x-ecmascript', 'application/avacript', 'applica/ecmascr', 'test/javacript',
            'text/javascript2.0', 'text/javascript1.6', 'text/javascript1.7',
        ];

        const script          = 'location.path = "/path";';
        const processedScript = processScript(script, true);

        const checkType = function (type) {
            const result   = this.toString();
            const root     = process('<script type="' + type + '">' + script + '</script>');
            const scriptEl = parse5Utils.findElementsByTagNames(root, 'script').script[0];

            expect(scriptEl.childNodes[0].value).eql(result);
        };

        casesWithCorrectType.forEach(checkType, processedScript);
        casesWithIncorrectType.forEach(checkType, script);
    });

    it('Should process <img> src', () => {
        let root = process('<img src="http://example.com/image.png">');
        let img  = parse5Utils.findElementsByTagNames(root, 'img').img[0];

        expect(domAdapter.getAttr(img, 'src')).eql('http://example.com/image.png');
        expect(domAdapter.getAttr(img, DomProcessor.getStoredAttrName('src'))).eql('http://example.com/image.png');

        root = process('<img src="">');
        img  = parse5Utils.findElementsByTagNames(root, 'img').img[0];

        expect(domAdapter.getAttr(img, 'src')).to.be.empty;
        expect(domAdapter.getAttr(img, DomProcessor.getStoredAttrName('src'))).to.be.empty;

        root = process('<img src="about:blank">');
        img  = parse5Utils.findElementsByTagNames(root, 'img').img[0];

        expect(domAdapter.getAttr(img, 'src')).eql('about:blank');
        expect(domAdapter.getAttr(img, DomProcessor.getStoredAttrName('src'))).eql('about:blank');
    });

    it('Should process target attribute for the elements in <iframe>', () => {
        let root = process('<a id="a" href="http://example.com"></a>' +
                             '<form id="form_simple" action="http://example.com"></form>' +
                             '<a id="a_target_top" href="http://example.com" target="_top"></a>' +
                             '<a id="a_target_parent" href="http://example.com" target="_parent"></a>', true);

        let elements = parse5Utils.findElementsByTagNames(root, ['a', 'form']);

        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.a[0], 'href')).resourceType).eql('i');
        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.form[0], 'action')).resourceType).eql('if');
        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.a[1], 'href')).resourceType).to.be.null;
        expect(domAdapter.getAttr(elements.a[2], 'href')).eql('http://example.com');

        root = process('<form id="form" action="http://example.com"></form>' +
                       '<form id="form_target_iframe" target="custom_iframe" action="http://example.com"></form>' +
                       '<iframe name="custom_iframe"></iframe>', false);

        elements = parse5Utils.findElementsByTagNames(root, ['form']);

        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.form[0], 'action')).resourceType).eql('f');
        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.form[1], 'action')).resourceType).eql('if');
    });

    it('Should process <iframe> with src without protocol', () => {
        const root                 = process('<iframe src="//cross.domain.com/"></iframe><iframe src="//example.com/"></iframe>');
        const iframes              = parse5Utils.findElementsByTagNames(root, 'iframe').iframe;
        const crossDomainIframeSrc = domAdapter.getAttr(iframes[0], 'src');
        const crossDomainProxyUrl  = urlUtils.getProxyUrl('http://cross.domain.com/', {
            proxyHostname: testProxyHostName,
            proxyPort:     testCrossDomainPort,
            sessionId:     'sessionId',
            resourceType:  'i',
        });
        const iframeSrc            = domAdapter.getAttr(iframes[1], 'src');
        const proxyUrl             = urlUtils.getProxyUrl('http://example.com/', {
            proxyHostname: testProxyHostName,
            proxyPort:     testProxyPort,
            sessionId:     'sessionId',
            resourceType:  'i',
        });

        expect(crossDomainIframeSrc).eql(crossDomainProxyUrl);
        expect(iframeSrc).eql(proxyUrl);
    });

    it('Should process iframe with cross-domain src', () => {
        const root          = process('<iframe src="http://cross.domain.com/"></iframe>');
        const iframe        = parse5Utils.findElementsByTagNames(root, 'iframe').iframe[0];
        const storedSrcAttr = DomProcessor.getStoredAttrName('src');

        expect(domAdapter.getAttr(iframe, 'src')).eql('http://localhost:' +
            testCrossDomainPort + '/sessionId!i/http://cross.domain.com/');
        expect(domAdapter.getAttr(iframe, storedSrcAttr)).eql('http://cross.domain.com/');
    });

    it('Should process iframe in https mode correctly', () => {
        const urlReplacer = (resourceUrl, resourceType) => {
            resourceUrl = urlLib.resolve('http://example.com/', resourceUrl);

            return urlUtils.getProxyUrl(resourceUrl, {
                proxyHostname: testProxyHostName,
                proxyPort:     testProxyPort,
                proxyProtocol: 'https:',
                sessionId:     'sessionId',
                resourceType,
            });
        };

        const root          = process('<iframe src="http://example.com/"></iframe>', false, urlReplacer);
        const iframe        = parse5Utils.findElementsByTagNames(root, 'iframe').iframe[0];
        const storedSrcAttr = DomProcessor.getStoredAttrName('src');

        expect(domAdapter.getAttr(iframe, 'src')).eql('https://localhost:' +
            testProxyPort + '/sessionId!i/http://example.com/');
        expect(domAdapter.getAttr(iframe, storedSrcAttr)).eql('http://example.com/');
    });

    it('Should process iframe with empty src', () => {
        const root          = process('<iframe src=""></iframe>');
        const iframe        = parse5Utils.findElementsByTagNames(root, 'iframe').iframe[0];
        const storedSrcAttr = DomProcessor.getStoredAttrName('src');

        expect(domAdapter.getAttr(iframe, 'src')).eql('');
        expect(domAdapter.getAttr(iframe, storedSrcAttr)).eql('');
    });

    describe('Regression', () => {
        it('Should not process documentFragment node (GH-912)', () => {
            const root                 = process('<body><template><div></div></template></body>');
            const templateNode         = parse5Utils.findElementsByTagNames(root, 'template').template[0];
            const documentFragmentNode = templateNode.content;

            expect(documentFragmentNode['hammerhead|element-processed']).to.not.to.be.true;
        });

        it('Should not contain the iframe flag on an input with type="image" (GH-2116)', () => {
            const root  = process('<input type="image" src="http://example.com/123.png">', true);
            const input = parse5Utils.findElementsByTagNames(root, 'input').input[0];

            expect(domAdapter.getAttr(input, 'src')).eql('http://localhost:80/sessionId!f/http://example.com/123.png');
        });
    });
});
