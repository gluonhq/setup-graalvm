import * as core from '@actions/core'
import * as io from '@actions/io'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import * as fs from 'fs'
import * as path from 'path'
import { Octokit } from '@octokit/action'

let tempDirectory = process.env['RUNNER_TEMP'] || ''

const IS_WINDOWS = process.platform === 'win32'
const IS_DARWIN = process.platform === 'darwin'

const octokit = new Octokit()

if (!tempDirectory) {
  let baseLocation
  if (IS_WINDOWS) {
    baseLocation = process.env['USERPROFILE'] || 'C:\\'
  } else if (IS_DARWIN) {
    baseLocation = '/Users'
  } else {
    baseLocation = '/home'
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp')
}

let platform = ''

if (IS_WINDOWS) {
  platform = 'windows'
} else if (IS_DARWIN) {
  platform = 'darwin'
} else {
  platform = 'linux'
}

export async function getGraalVM(
    graalvm: string,
    jdk: string,
    arch: string
): Promise<void> {
  let version = `${graalvm}`
  if (version === 'latest') {
    const response = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
      owner: 'gluonhq',
      repo: 'graal'
    })
    version = response.data.tag_name
  } else {
    version = `gluon-${graalvm}`
  }
  let graalvmShort = `${version}`
  if (version.includes('-dev-')) {
    graalvmShort = version.substr(0, version.indexOf('-dev-') + 4)
  }
  core.info(`Version of graalvm: ${version}, short: ${graalvmShort}`)
  let toolPath = tc.find('GraalVM', getCacheVersionString(version), arch)

  const allGraalVMVersions = tc.findAllVersions('GraalVM', arch)
  core.info(`Versions of graalvm available: ${allGraalVMVersions}`)

  if (toolPath) {
    core.debug(`GraalVM found in cache ${toolPath}`)
  } else {
    let java = ``
    let m1 = ``
    if (jdk == 'java17' || jdk == 'java11') {
      java = `-${jdk}`
      if (arch == 'aarch64') {
        m1 = `-m1`
      }
    }
    let ext = 'tar.gz'
    if (IS_WINDOWS || graalvmShort.startsWith('gluon-22.0') || graalvmShort.startsWith('gluon-21')) {
      ext = 'zip'
    }
    const downloadPath = `https://github.com/gluonhq/graal/releases/download/${version}/graalvm-svm${java}-${platform}${m1}-${graalvmShort}.${ext}`

    core.info(`Downloading Gluon's GraalVM from ${downloadPath}`)

    const graalvmFile = await tc.downloadTool(downloadPath)
    const tempDir: string = path.join(
      tempDirectory,
      `temp_${Math.floor(Math.random() * 2000000000)}`
    )
    const graalvmDir = await unpackGraalVMDownload(
      graalvmFile,
      tempDir
    )
    core.debug(`graalvm extracted to ${graalvmDir}`)
    toolPath = await tc.cacheDir(
      graalvmDir,
        'GraalVM',
        getCacheVersionString(version),
        arch
    )
  }

  const extendedJavaHome = `JAVA_HOME_${version}`
  core.exportVariable('JAVA_HOME', toolPath)
  core.exportVariable(extendedJavaHome, toolPath)
  core.exportVariable('GRAALVM_HOME', toolPath)
  core.addPath(path.join(toolPath, 'bin'))
}

function getCacheVersionString(version: string): string {
  const versionArray = version.split('.')
  const major = versionArray[0]
  const minor = versionArray.length > 1 ? versionArray[1] : '0'
  const patch = versionArray.length > 2 ? versionArray.slice(2).join('-') : '0'
  return `${major}.${minor}.${patch}`
}

async function extractFiles(
  file: string,
  destinationFolder: string
): Promise<void> {
  const stats = fs.statSync(file)
  if (!stats) {
    throw new Error(`Failed to extract ${file} - it doesn't exist`)
  } else if (stats.isDirectory()) {
    throw new Error(`Failed to extract ${file} - it is a directory`)
  }

  if (file.endsWith('zip')) {
    await tc.extractZip(file, destinationFolder)
  } else {
    await tc.extractTar(file, destinationFolder)
  }
  
}

async function unpackJars(fsPath: string, javaBinPath: string): Promise<void> {
  if (fs.existsSync(fsPath)) {
    if (fs.lstatSync(fsPath).isDirectory()) {
      for (const file of fs.readdirSync(fsPath)) {
        const curPath = path.join(fsPath, file)
        await unpackJars(curPath, javaBinPath)
      }
    } else if (path.extname(fsPath).toLowerCase() === '.pack') {
      // Unpack the pack file synchonously
      const p = path.parse(fsPath)
      const toolName = IS_WINDOWS ? 'unpack200.exe' : 'unpack200'
      const args = IS_WINDOWS ? '-r -v -l ""' : ''
      const name = path.join(p.dir, p.name)
      await exec.exec(`"${path.join(javaBinPath, toolName)}"`, [
        `${args} "${name}.pack" "${name}.jar"`
      ])
    }
  }
}

async function unpackGraalVMDownload(
  repoRoot: string,
  destinationFolder: string
): Promise<string> {
  await io.mkdirP(destinationFolder)

  const graalvmFile = path.normalize(repoRoot)
  const stats = fs.statSync(graalvmFile)
  if (stats.isFile()) {
    await extractFiles(graalvmFile, destinationFolder)
    const graalvmFolder = fs.readdirSync(destinationFolder)[0]
    if (IS_DARWIN) {
      for (const f of fs.readdirSync(
        path.join(destinationFolder, graalvmFolder, 'Contents', 'Home')
      )) {
        await io.cp(
          path.join(destinationFolder, graalvmFolder, 'Contents', 'Home', f),
          path.join(destinationFolder, graalvmFolder, f),
          {recursive: true}
        )
      }
      await io.rmRF(path.join(destinationFolder, graalvmFolder, 'Contents'))
    }
    const graalvmDirectory = path.join(destinationFolder, graalvmFolder)
    await unpackJars(graalvmDirectory, path.join(graalvmDirectory, 'bin'))
    return graalvmDirectory
  } else {
    throw new Error(`Jdk argument ${graalvmFile} is not a file`)
  }
}
