#!/usr/bin/env bash

mkdir ../testcafe
cd ../testcafe
git clone https://github.com/DevExpress/testcafe .

# NOTE: testcafe's Gulpfile.js tries to alias the 'travis' task to the value of GULP_TASK
# We should define a valid testcafe's task in GULP_TASK before running 'npm install',
# which automatically builds testcafe with Gulp. 
export GULP_TASK="test-functional-local-headless-chrome"

npm install testcafe-hammerhead ../testcafe-hammerhead --save

npm test
