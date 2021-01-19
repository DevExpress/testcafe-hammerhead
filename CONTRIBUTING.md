# Contributing to TestCafe Hammerhead

TestCafe Hammerhead would not be possible without active support from the community. We appreciate and encourage your contributions, no matter how big or small.

Review our contribution guidelines:

* [Code of Conduct](#code-of-conduct)
* [General Discussion](#general-discussion)
* [Reporting a Problem](#reporting-a-problem)
* [Code Contribution](#code-contribution)

## Code of Conduct

TestCafe Hammerhead abides by the [Contributor Code of Conduct](CODE_OF_CONDUCT.md).

## General Discussion

Join the TestCafe Hammerhead community on Stack Overflow: ask and answer [questions with the TestCafe tag](https://stackoverflow.com/questions/tagged/testcafe).

## Reporting a Problem

If you encounter a bug with TestCafe Hammerhead, please file an issue in the [GitHub repository](https://github.com/DevExpress/testcafe-hammerhead/issues).
Search through the existing issues to see if the problem has already been reported or addressed.

When you create a new issue, the template text is automatically added to its body. You should complete all sections in this template to help us understand the issue. Missing information could delay the processing time.

## Code Contribution

Follow the steps below when submitting your code.

1. Search the [list of issues](https://github.com/DevExpress/testcafe-hammerhead/issues) to see if there is an issue for the bug or feature you are going to work on or create a new one.

2. To address an already described issue, check the comment thread to make sure that no one is working on it at the moment. Leave a comment saying that you are willing to fix this issue, and include details on how you plan to do this. Core team members may need to discuss the details of the proposed fix with you. After they have approved it, leave a comment saying that you started your work on this issue.

3. Install [Node.js](https://nodejs.org/en/) on your development machine.

4. Fork TestCafe Hammerhead and create a branch in your fork. Name this branch with an issue number, for example, `gh852`, `gh853`.
  
5. Install dependencies. In the root directory of your local copy, run:

    ```sh
    npm install
    ```

    or (for [Yarn](https://yarnpkg.com/) users):

    ```sh
    yarn
    ```

6. Write code and commit your changes to the branch.

    To build and launch TestCafe Hammerhead, run the `http-playground` task:

    ```sh
    gulp http-playground
    ```

    The `http-playground` task builds Hammerhead, launches a local HTTP server, and opens a playground page, where you can specify a web page to proxy.

    To run a playground over HTTPS, run the `https-playground` task.

    ```sh
    gulp https-playground
    ```

7. Add regression tests to appropriate sections if you are fixing a bug. To find these sections, search for `Regression` in the code.

    For new functionality, add unit/functional tests.

8. Fetch upstream changes and rebase your branch onto `master`.

9. Run tests to check that everything works.

    ```sh
    gulp test-server
    gulp test-client
    ```

10. Push changes to your fork and open a pull request.

Before you submit your pull request, it has to satisfy the following conditions:

* The pull request name should describe the changes you implemented
* The pull request description should contain the [closes](https://github.com/blog/1506-closing-issues-via-pull-requests) directive with an appropriate issue number
* All existing and new tests must be passing
* Code must be linted without errors (see [Build Instructions](#build-instructions))

## Build Instructions

Before you submit a pull request, lint your code. The `build` task runs `eslint` to lint your code:

```sh
gulp build
```

The `/lib` directory stores build artifacts. Build tasks remove this folder before they run. To remove the folder manually, run:

```sh
gulp clean
```
