#!/usr/bin/env bash

mkdir ../testcafe
cd ../testcafe
git clone -b vuln-fix-update https://github.com/Bayheck/testcafe .

npm install testcafe-hammerhead ../testcafe-hammerhead --save
npm i --loglevel error

npm test
