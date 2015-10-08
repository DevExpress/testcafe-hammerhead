var OS            = require('os-family');
var expect        = require('chai').expect;
var windowsDomain = require('../../lib/request-pipeline/destination-request/windows-domain');

describe('Windows domain', function () {
    if (OS.win) {
        it('Should assign windows domain and workstation to credentials', function (done) {
            var credentials = {};

            windowsDomain.assign(credentials).then(function () {
                expect(credentials.domain).to.be.a('string');
                expect(credentials.workstation).to.be.a('string');

                done();
            });
        });
    }
});
