const util = require('gulp-util');

module.exports = function getClientTestSettings () {
    return {
        basePath:        './test/client/fixtures',
        port:            3000,
        crossDomainPort: 3001,
        scripts:         [
            { src: '/hammerhead.js', path: util.env.dev ? './lib/client/hammerhead.js' : './lib/client/hammerhead.min.js' },
            { src: '/before-test.js', path: './test/client/before-test.js' }
        ],

        configApp: require('../../test/client/config-qunit-server-app')
    };
};
