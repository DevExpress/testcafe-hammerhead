const CLIENT_TESTS_BROWSERS = [
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge'
    },
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge',
        version:     '90'
    },
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge',
        version:     '89'
    },
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge',
        version:     '88'
    },
    {
        platform:    'Windows 10',
        browserName: 'MicrosoftEdge',
        version:     '87'
    }
    // {
    //     platform:    'Windows 10',
    //     browserName: 'chrome'
    // },
    // {
    //     platform:    'Windows 10',
    //     browserName: 'firefox'
    // },
    // {
    //     platform:    'Windows 10',
    //     browserName: 'internet explorer',
    //     version:     '11.0'
    // },
    // {
    //     browserName: 'safari',
    //     platform:    'macOS 10.14',
    //     version:     '12.0'
    // },
    // {
    //     browserName: 'safari',
    //     platform:    'macOS 10.15',
    //     version:     'latest'
    // },
    // {
    //     browserName:     'Safari',
    //     deviceName:      'iPhone 7 Plus Simulator',
    //     platformVersion: '11.3',
    //     platformName:    'iOS'
    // },
    // {
    //     deviceName:      'Android GoogleAPI Emulator',
    //     browserName:     'Chrome',
    //     platformVersion: '7.1',
    //     platformName:    'Android'
    // },
    // {
    //     browserName: 'chrome',
    //     platform:    'OS X 10.11'
    // },
    // {
    //     browserName: 'firefox',
    //     platform:    'OS X 10.11'
    // }
];

const SAUCELABS_SETTINGS = {
    username:  process.env.SAUCE_USERNAME,
    accessKey: process.env.SAUCE_ACCESS_KEY,
    build:     process.env.TRAVIS_JOB_ID || '',
    tags:      [process.env.TRAVIS_BRANCH || 'master'],
    browsers:  CLIENT_TESTS_BROWSERS,
    name:      'testcafe-hammerhead client tests',
    timeout:   360
};

module.exports = SAUCELABS_SETTINGS;
