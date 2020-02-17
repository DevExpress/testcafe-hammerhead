# Contributing to TestCafe Hammerhead

TestCafe Hammerhead would not be possible without active support from the community. We appreciate and encourage your contributions, no matter how big  or small.

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

If you encounter a bug when using TestCafe Hammerhead, please file an issue in our [GitHub repository](https://github.com/DevExpress/testcafe-hammerhead/issues).
We recommend searching through the existing issues to see if the problem has already been reported or addressed.

When you create a new issue, the template text is automatically added to its body. You should complete all the sections in this template to help us understand the issue you are describing. Missing information could delay the processing time.

## Code Contribution

Follow the steps below when submitting your code.

1. Search the [list of issues](https://github.com/DevExpress/testcafe-hammerhead/issues) to see if there is an issue for the bug or feature you are going to work on or create a new one.

2. If you are going to address an existing issue, check the comment thread to make sure that nobody is working on it at the moment.

3. Leave a comment saying that you are willing to fix this issue, and if possible, provide details on how you are going to do this.

4. Core team members may need to discuss the details of the proposed fix with you. As soon as you get the green light from them,
  leave a comment saying that you are currently working on this issue.

5. Fork TestCafe Hammerhead and create a branch in your fork. Name this branch with an issue number, for example `gh852`, `gh853`.
  
6. Commit your changes into the branch.

7. Add regression tests to the appropriate sections if you are fixing a bug. You can find these sections by searching for `Regression` in the code.

    Add unit and/or functional tests if you are developing a new functionality.

8. Fetch upstream changes and rebase your branch onto `master`.

9. Run tests before submitting a pull request to ensure that everything works properly.

    ```sh
    gulp test-server
    gulp test-client
    ```

10. Push changes to your fork.

11. Submit a pull request.

    The pull request name should describe what has been done and contain
    the [closes](https://github.com/blog/1506-closing-issues-via-pull-requests) directive
    with an appropriate issue number.
