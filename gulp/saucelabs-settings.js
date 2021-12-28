const CLIENT_TESTS_BROWSERS = [
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge'
    },
    {
        platform:    'Windows 10',
        browserName: 'chrome'
    },
    {
        platform:    'Windows 10',
        browserName: 'firefox'
    },
    {
        platform:    'Windows 10',
        browserName: 'internet explorer',
        version:     '11.0'
    },
    {
        browserName: 'safari',
        platform:    'macOS 11.00',
        version:     '14'
    },
    {
        browserName: 'safari',
        platform:    'macOS 12',
        version:     '15'
    },
    {
        browserName:     'Safari',
        deviceName:      'iPhone 7 Plus Simulator',
        platformVersion: '11.3',
        platformName:    'iOS'
    },
    {
        deviceName:      'Android GoogleAPI Emulator',
        browserName:     'Chrome',
        platformVersion: '7.1',
        platformName:    'Android'
    },
    {
        browserName: 'chrome',
        platform:    'macOS 10.15'
    },
    {
        browserName: 'firefox',
        platform:    'macOS 10.15'
    }
];

const SAUCELABS_SETTINGS = {
    username:  process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    build:     process.env.TRAVIS_JOB_ID || '',
    tags:      [process.env.TRAVIS_BRANCH || 'master'],
    browsers:  CLIENT_TESTS_BROWSERS,
    name:      'testcafe-hammerhead client tests',
    timeout:   720
};

module.exports = SAUCELABS_SETTINGS;
