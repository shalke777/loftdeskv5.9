// Raw markdown imports — Vite resolves these at build time
import regulaminRaw from '@docs-legal/01-regulamin.md?raw'
import prywatnosc from '@docs-legal/02-polityka-prywatnosci.md?raw'
import cookies from '@docs-legal/03-polityka-cookies.md?raw'
import dpa from '@docs-legal/04-dpa-umowa-powierzenia.md?raw'
import subprocesorzy from '@docs-legal/06-polityka-subprocesorow.md?raw'
import zasadyPlatnosci from '@docs-legal/07-zasady-platnosci.md?raw'
import reklamacje from '@docs-legal/08-procedura-reklamacyjna.md?raw'
import aup from '@docs-legal/10-zasady-bezpieczenstwa-aup.md?raw'

export type LegalDocKey =
  | 'regulamin'
  | 'polityka-prywatnosci'
  | 'polityka-cookies'
  | 'dpa'
  | 'subprocesorzy'
  | 'zasady-platnosci'
  | 'reklamacje'
  | 'aup'

export const DOC_CONTENT: Record<LegalDocKey, string> = {
  'regulamin': regulaminRaw,
  'polityka-prywatnosci': prywatnosc,
  'polityka-cookies': cookies,
  'dpa': dpa,
  'subprocesorzy': subprocesorzy,
  'zasady-platnosci': zasadyPlatnosci,
  'reklamacje': reklamacje,
  'aup': aup,
}

export const DOC_LABELS: Record<LegalDocKey, string> = {
  'regulamin': 'Regulamin świadczenia usług',
  'polityka-prywatnosci': 'Polityka prywatności',
  'polityka-cookies': 'Polityka cookies',
  'dpa': 'Umowa powierzenia przetwarzania danych (DPA)',
  'subprocesorzy': 'Polityka subprocesorów',
  'zasady-platnosci': 'Zasady płatności i subskrypcji',
  'reklamacje': 'Procedura reklamacyjna',
  'aup': 'Zasady Akceptowalnego Użytkowania (AUP)',
}
