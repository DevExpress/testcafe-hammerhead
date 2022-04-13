const hang = require('./hang');

module.exports = function (options) {
    require('../../test/playground/server.js').start(options);

    return hang();
};
