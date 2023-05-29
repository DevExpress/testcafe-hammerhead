const CLIENT_TESTS_BROWSERS = [
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge',
    },
    {
        platform:    'Windows 10',
        browserName: 'chrome',
    },
    {
        platform:    'Windows 10',
        browserName: 'firefox',
    },
    {
        browserName: 'safari',
        platform:    'macOS 13',
        version:     '16',
    },
    {
        browserName:     'Safari',
        deviceName:      'iPhone 7 Plus Simulator',
        platformVersion: '15.5',
        platformName:    'iOS',
    },
    {
        deviceName:      'Android GoogleAPI Emulator',
        browserName:     'Chrome',
        platformVersion: '7.1',
        platformName:    'Android',
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
