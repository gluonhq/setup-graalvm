import * as core from '@actions/core'
import * as installer from './installer'
import * as path from 'path'

async function run(): Promise<void> {
  try {
    const graalvm = core.getInput('graalvm')
    const jdk = core.getInput('jdk')
    const arch = core.getInput('arch')

    await installer.getGraalVM(graalvm, jdk, arch)

    const matchersPath = path.join(__dirname, '..', '.github')
    core.info(`##[add-matcher]${path.join(matchersPath, 'graalvm.json')}`)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
