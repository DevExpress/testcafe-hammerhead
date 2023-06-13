const fs                  = require('fs');
const { injectResources } = require('../../../lib');
const { compareCode }     = require('../common/utils');

describe('New API', () => {
    const resources = {
        stylesheets:     ['./styles.css'],
        scripts:         ['common/script1.js', './common/script2.js'],
        embeddedScripts: ['var script1 = 1;', 'var script2 = 2;'],
        userScripts:     ['/custom-script1.js', '/custom-script2.js'],
    };

    const pageContent         = fs.readFileSync('test/server/data/without-request-pipeline/src.html').toString();
    const expectedPageContent = fs.readFileSync('test/server/data/without-request-pipeline/expected.html').toString();

    it('PageProcessor.injectResources', () => {
        const updatedPageContent = injectResources(pageContent, resources);

        compareCode(updatedPageContent, expectedPageContent);
    });

    it('PageProcessor.injectResources - trim BOM', () => {
        const bomSymbol          = String.fromCharCode(65279);
        const updatedPageContent = injectResources(bomSymbol + pageContent, resources);

        updatedPageContent.charCodeAt(0) === bomSymbol;

        compareCode(updatedPageContent, expectedPageContent);
    });
});
