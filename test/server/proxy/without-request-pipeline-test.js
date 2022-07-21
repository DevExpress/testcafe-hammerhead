const fs                  = require('fs');
const { injectResources } = require('../../../lib');
const { compareCode }     = require('../common/utils');

describe('New API', () => {
    it('PageProcessor.injectResources', () => {
        const pageContent = fs.readFileSync('test/server/data/without-request-pipeline/src.html').toString();

        const resources = {
            stylesheets:     ['./styles.css'],
            scripts:         ['common/script1.js', './common/script2.js'],
            embeddedScripts: ['var script1 = 1;', 'var script2 = 2;'],
        };

        const updatedPageContent  = injectResources(pageContent, resources);
        const expectedPageContent = fs.readFileSync('test/server/data/without-request-pipeline/expected.html').toString();

        compareCode(updatedPageContent, expectedPageContent);
    });
});
