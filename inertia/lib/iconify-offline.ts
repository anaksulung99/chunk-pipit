import { addCollection, addIcon, Icon, type IconifyJSON } from '@iconify/vue/offline'
import lucideIcons from '@iconify-json/lucide/icons.json'
import hugeiconsIcons from '@iconify-json/hugeicons/icons.json'
import materialSymbolsIcons from '@iconify-json/material-symbols/icons.json'
import materialSymbolsLightIcons from '@iconify-json/material-symbols-light/icons.json'
import radixIcons from '@iconify-json/radix-icons/icons.json'
import mdiIcons from '@iconify-json/mdi/icons.json'
import icIcons from '@iconify-json/ic/icons.json'
import heroiconsIcons from '@iconify-json/heroicons/icons.json'
import phIcons from '@iconify-json/ph/icons.json'
import stashIcons from '@iconify-json/stash/icons.json'
import logosJson from '@iconify-json/logos/icons.json'
import fluentColorIcon from '@iconify-json/fluent-color/icons.json'

let registered = false

function registerCollections() {
  if (registered) {
    return
  }

  addCollection(lucideIcons as IconifyJSON)
  addCollection(hugeiconsIcons as IconifyJSON)
  addCollection(materialSymbolsIcons as IconifyJSON)
  addCollection(materialSymbolsLightIcons as IconifyJSON)
  addCollection(radixIcons as IconifyJSON)
  addCollection(mdiIcons as IconifyJSON)
  addCollection(icIcons as IconifyJSON)
  addCollection(heroiconsIcons as IconifyJSON)
  addCollection(phIcons as IconifyJSON)
  addCollection(stashIcons as IconifyJSON)
  addCollection(logosJson as IconifyJSON)
  addCollection(fluentColorIcon as IconifyJSON)
  registered = true
}

registerCollections()

export { addCollection, addIcon, Icon }
export default Icon
