# setup-graalvm

This action sets up the [GraalVM built by Gluon](https://github.com/gluonhq/graal) environment for using in GitHub Actions.

* It downloads (if it is not cached yet) required version of Gluon's build of GraalVM Community edition
* Adds executors provided by GraalVM distribution to the environment
* Register problem matchers for error output

# Usage

```yaml
steps:
- uses: actions/checkout@latest
- uses: gluonhq/setup-graalvm@master
  # set GITHUB_TOKEN to avoid exceeding GitHub's API rate limit
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    # GraalVM version. Default: latest
    graalvm: '22.1.0.1-Final'
    # Java version. Since GraalVM 22, either java11, java17 or java23. Before GraalVM 22, empty. Default: java23
    jdk: 'java23'
    # Architecture flag. Available options are 'x86_64' (default) and 'aarch64'. The latter is available for M1 runners starting GraalVM 22.1.
    arch: 'x86_64'
- run: java -version
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Developers

To build the action locally, run the following:

```
nmp install
npm i -g @vercel/ncc
ncc build src/setup-graalvm.ts -o dist
```