const Session    = require('../../lib/session');
const { expect } = require('chai');

describe('Common', () => {
    // NOTE: It's necessary only for the Legacy API tests.
    // Remove it after the Legacy API tests are removed.
    it('Session should have EventEmitter capabilities', () => {
        const session = new Session('test-folder');

        expect(session.on).to.be.a('function');
        expect(session.once).to.be.a('function');
        expect(session.emit).to.be.a('function');
        expect(session.off).to.be.a('function');
    });
});
