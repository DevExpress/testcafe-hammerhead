#!/usr/bin/env bash

# pwd is /home/runner/work/testcafe-hammerhead/testcafe-hammerhead
mkdir ../../testcafe

cd ../../testcafe
# pwd is /home/runner/work/testcafe

git clone https://github.com/DevExpress/testcafe .

patch -p0 < ../testcafe-hammerhead/testcafe-hammerhead/patch_test.patch

# NOTE: testcafe's Gulpfile.js tries to alias the 'travis' task to the value of GULP_TASK
# We should define a valid testcafe's task in GULP_TASK before running 'npm install',
# which automatically builds testcafe with Gulp. 
export GULP_TASK="test-functional-local-headless-chrome"

npm install testcafe-hammerhead ../testcafe-hammerhead/testcafe-hammerhead --save
npm i --loglevel error

npx gulp fast-build --steps-as-tasks
npx gulp test-functional-local-headless-chrome-run --steps-as-tasks
