const contentTypeUtils = require('../../lib/utils/content-type');
const expect           = require('chai').expect;

it('Should detect scripts', () => {
    const checkScript = (contentType, accept) => {
        expect(contentTypeUtils.isScriptResource(contentType, accept)).to.be.true;
    };

    checkScript('APPLICATION/ECMASCRIPT; charset=utf-8', '*/*');
    checkScript('application/javascript; charset=utf-8', '*/*');
    checkScript('application/x-ecmascript; charset=utf-8', '*/*');
    checkScript('application/x-javascript; charset=utf-8', '*/*');
    checkScript('text/ecmascript; charset=utf-8', '*/*');
    checkScript('text/javascript; charset=utf-8', '*/*');
    checkScript('text/javascript1.0; charset=utf-8', '*/*');
    checkScript('text/javascript1.1; charset=utf-8', '*/*');
    checkScript('text/javascript1.2; charset=utf-8', '*/*');
    checkScript('text/javascript1.3; charset=utf-8', '*/*');
    checkScript('text/javascript1.4; charset=utf-8', '*/*');
    checkScript('text/javascript1.5; charset=utf-8', '*/*');
    checkScript('text/jscript; charset=utf-8', '*/*');
    checkScript('text/livescript; charset=utf-8', '*/*');
    checkScript('text/x-ecmascript; charset=utf-8', '*/*');
    checkScript('text/x-javascript; charset=utf-8', '*/*');

    checkScript('text/plain', 'APPLICATION/ECMASCRIPT');
    checkScript('text/plain', 'application/javascript');
    checkScript('text/plain', 'application/x-ecmascript');
    checkScript('text/plain', 'application/x-javascript');
    checkScript('text/plain', 'text/ecmascript');
    checkScript('text/plain', 'text/javascript');
    checkScript('text/plain', 'text/javascript1.0');
    checkScript('text/plain', 'text/javascript1.1');
    checkScript('text/plain', 'text/javascript1.2');
    checkScript('text/plain', 'text/javascript1.3');
    checkScript('text/plain', 'text/javascript1.4');
    checkScript('text/plain', 'text/javascript1.5');
    checkScript('text/plain', 'text/jscript');
    checkScript('text/plain', 'text/livescript');
    checkScript('text/plain', 'text/x-ecmascript');
    checkScript('text/plain', 'text/x-javascript');
});

it('Should detect css', () => {
    expect(contentTypeUtils.isCSSResource('TEXT/CSS', '*/*')).to.be.true;
    expect(contentTypeUtils.isCSSResource('', 'TEXT/CSS')).to.be.true;
});

it('Should detect manifest', () => {
    expect(contentTypeUtils.isManifest('text/CACHE-manifest')).to.be.true;
});

it('Should detect page', () => {
    expect(contentTypeUtils.isPage('TEXT/HTML')).to.be.true;
    expect(contentTypeUtils.isPage('application/xhtml+xml')).to.be.true;
    expect(contentTypeUtils.isPage('application/xml')).to.be.true;
    expect(contentTypeUtils.isPage('application/x-ms-application')).to.be.true;
});

it('Should detect text page', () => {
    expect(contentTypeUtils.isTextPage('')).to.be.true;
    expect(contentTypeUtils.isTextPage('text/plain')).to.be.true;
});
