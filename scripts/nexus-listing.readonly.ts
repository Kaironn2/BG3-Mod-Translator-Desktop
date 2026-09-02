import { NexusApi } from '../src/main/services/nexus/nexus.api'
import {
  ICOSA_INSTALLER_FILE_NAME,
  ICOSA_NEXUS_GAME_SCOPED_ID,
  ICOSA_PORTABLE_FILE_NAME,
  NEXUS_GAME_DOMAIN
} from '../src/main/services/nexus/nexus.constants'
import { NexusClient } from '../src/main/services/nexus/nexus-client'
import { buildFileDescription } from '../src/main/services/nexus/nexus-description'
import {
  findModFileByLatestVersionName,
  findModFileByName,
  resolveLatestVersion
} from '../src/main/services/nexus/nexus-mod-files'

const key = process.env.NEXUS_API_KEY?.trim()
if (!key) throw new Error('NEXUS_API_KEY missing')

const client = new NexusClient({ apiKey: key, userAgent: 'Icosa-dev-listing-test' })
const api = new NexusApi(client)

async function main(): Promise<void> {
  const mod = await api.getMod(NEXUS_GAME_DOMAIN, ICOSA_NEXUS_GAME_SCOPED_ID)
  const modId = mod.data.id
  console.log(`Mod ${ICOSA_NEXUS_GAME_SCOPED_ID} -> internal id ${modId} ("${mod.data.name}")`)

  const { data } = await api.getModFiles(modId)
  const modFiles = data.mod_files
  console.log(`Mod has ${modFiles.length} mod files:`)
  for (const file of modFiles) {
    console.log(
      `  - [${file.id}] "${file.name}" versions=${file.versions_count} active=${file.is_active}`
    )
  }

  for (const target of [ICOSA_PORTABLE_FILE_NAME, ICOSA_INSTALLER_FILE_NAME]) {
    const byName = findModFileByName(modFiles, target)
    const viaVersion = byName
      ? undefined
      : await findModFileByLatestVersionName(api, modFiles, target)
    const file = byName ?? viaVersion?.file
    console.log(`\n"${target}":`)
    if (!file) {
      console.log('  NOT FOUND (neither mod file name nor latest version name)')
      continue
    }
    console.log(`  mod file [${file.id}] "${file.name}"`)
    const latest = viaVersion?.latest ?? (await resolveLatestVersion(api, file.id))
    if (latest) {
      console.log(
        `  latest version id=${latest.id} version=${latest.version} category=${latest.category}`
      )
      console.log(`  previous_version_id for next upload = ${latest.id}`)
    } else {
      console.log('  (no versions)')
    }
  }

  console.log('\nDescription sample (255 cap):')
  for (const note of [undefined, 'Self-contained build; no installer required']) {
    const text = buildFileDescription({
      version: '1.18.0',
      summary: 'New in v1.18.0:\n- Nexus auto-publish from version bump',
      variantNote: note
    })
    console.log(`  [${text.length} chars] ${text}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
