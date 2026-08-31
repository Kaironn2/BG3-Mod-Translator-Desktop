const { app } = require('electron')
const path = require('path')

const scriptPath = process.argv[2]
const scriptArgs = process.argv.slice(3)
if (!scriptPath || scriptPath.startsWith('-')) {
  console.error('usage: electron electron-runner.cjs <compiled-script> [script-args...]')
  process.exit(2)
}
// Compiled bundles live in scripts/<name>.cjs (one level up from scripts/dev/);
// resolve relative to the repo root so both `scripts/foo.cjs` and absolute paths work.
const resolvedScript = path.isAbsolute(scriptPath)
  ? scriptPath
  : path.resolve(__dirname, '..', path.basename(scriptPath))
// Compiled scripts read process.argv[2] as their first argument, mirroring
// `node script.cjs <arg>`; under Electron it's argv[3], so re-normalize here.
process.argv = [process.argv[0], resolvedScript, ...scriptArgs]

app
  .whenReady()
  .then(async () => {
    try {
      await require(resolvedScript)
      setTimeout(() => app.exit(0), 300)
    } catch (err) {
      console.error(err)
      app.exit(1)
    }
  })
  .catch((err) => {
    console.error(err)
    app.exit(1)
  })