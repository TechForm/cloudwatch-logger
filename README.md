# cloudwatch-logging

A simple logger, which writes to files in accordance with cloudwatch restrictions

## Local development

This project uses yarn v3 with plug'n'play functionality. Yarn requires it's own fixes implemented in the typescript package, and some setup is required to make VSCode understand that. Read more about why [here](https://yarnpkg.com/getting-started/editor-sdks).

After cloning and installing dependencies, run `yarn sdks vscode` to make vscode understand how to look for typescript types and use the modified version of typescript instead of the one installed in VSCode. A prompt will appear asking if you would like to use the workspace version of typescript, accept this prompt and your intellisense should work correctly.
