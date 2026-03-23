// ClientIdentifyCTA ÔÇö informational banner on the legacy /portal/:token page.
// The new client portal flow uses magic links Ôćĺ /client/* routes.

interface Props {
  portalToken?: string
}

export function ClientIdentifyCTA({ portalToken: _portalToken }: Props) {
  return (
    <div
      style={{
        background:    'rgba(119,186,138,0.12)',
        border:        '1px solid rgba(119,186,138,0.30)',
        borderRadius:  12,
        padding:       '14px 18px',
        marginBottom:  20,
        fontSize:      13,
        color:         '#77BA8A',
        lineHeight:    1.6,
      }}
    >
      <strong>Nowy portal klienta</strong> ÔÇö skontaktuj si─Ö ze swoj─ů firm─ů budowlan─ů,
      aby otrzyma─ç indywidualny link do pe┼énego portalu projektu.
    </div>
  )
}
