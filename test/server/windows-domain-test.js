const OS            = require('os-family');
const expect        = require('chai').expect;
const windowsDomain = require('../../lib/request-pipeline/destination-request/windows-domain');

describe('Windows domain', () => {
    if (OS.win) {
        it('Should assign windows domain and workstation to credentials', () => {
            const credentials = {};

            return windowsDomain.assign(credentials)
                .then(() => {
                    expect(credentials.domain).to.be.a('string');
                    expect(credentials.workstation).to.be.a('string');
                });
        });
    }
});
