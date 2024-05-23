const CLIENT_TESTS_BROWSERS = [
    {
        platform:    'Windows 10',
        browserName: 'chrome',
    },
];

const SAUCELABS_SETTINGS = {
    username:  process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    build:     process.env.TRAVIS_JOB_ID || '',
    tags:      [process.env.TRAVIS_BRANCH || 'master'],
    browsers:  CLIENT_TESTS_BROWSERS,
    name:      'testcafe-hammerhead client tests',
    timeout:   720,
};

module.exports = SAUCELABS_SETTINGS;
