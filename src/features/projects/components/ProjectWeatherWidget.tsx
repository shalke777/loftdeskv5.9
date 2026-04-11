// ProjectWeatherWidget — E2: Prognoza pogody dla budowy
// Uses open-meteo.com (free, no API key) + open-meteo geocoding
// Shows 3-day forecast for project address with risk indicators
import { useEffect, useState } from 'react'
import { CloudRain, Snowflake, Wind, Thermometer, CloudSun, Sun, Cloud, AlertTriangle } from 'lucide-react'

// WMO weather code → icon + label
function decodeWeather(code: number): { label: string; risk: 'clear' | 'watch' | 'danger'; icon: React.ElementType } {
  if (code === 0)                      return { label: 'Bezchmurnie',    risk: 'clear',  icon: Sun }
  if (code <= 2)                       return { label: 'Częściowo pochmurnie', risk: 'clear', icon: CloudSun }
  if (code === 3)                      return { label: 'Zachmurzenie',   risk: 'clear',  icon: Cloud }
  if (code >= 51 && code <= 67)        return { label: 'Deszcz',         risk: 'watch',  icon: CloudRain }
  if (code >= 71 && code <= 77)        return { label: 'Śnieg',          risk: 'danger', icon: Snowflake }
  if (code >= 80 && code <= 82)        return { label: 'Opady deszczu',  risk: 'watch',  icon: CloudRain }
  if (code >= 85 && code <= 86)        return { label: 'Opady śniegu',   risk: 'danger', icon: Snowflake }
  if (code >= 95 && code <= 99)        return { label: 'Burza',          risk: 'danger', icon: CloudRain }
  if (code >= 45 && code <= 48)        return { label: 'Mgła',           risk: 'watch',  icon: Cloud }
  return { label: 'Zmienna pogoda', risk: 'watch', icon: CloudSun }
}

function riskColor(risk: 'clear' | 'watch' | 'danger') {
  if (risk === 'clear')  return 'var(--color-success)'
  if (risk === 'watch')  return 'var(--color-warning, #f59e0b)'
  return 'var(--color-error, #ef4444)'
}

function riskBg(risk: 'clear' | 'watch' | 'danger') {
  if (risk === 'clear')  return 'rgba(16,185,129,0.08)'
  if (risk === 'watch')  return 'rgba(245,158,11,0.10)'
  return 'rgba(239,68,68,0.10)'
}

type DayForecast = {
  date: string
  code: number
  maxTemp: number
  minTemp: number
  precipProb: number
  windMax: number
}

function extractCity(address: string): string {
  if (!address) return ''
  // Try to find a Polish city from address string
  // "ul. Kwiatowa 5, Warszawa" → "Warszawa"
  // "Kraków, ul. Długa 2" → "Kraków"
  const parts = address.split(/,\s*/)
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].trim().replace(/^(ul\.|al\.|os\.|pl\.|str\.)\s*/i, '')
    // City names are typically 3+ chars, no digits
    if (p.length >= 3 && !/\d/.test(p)) return p.split(' ')[0]
  }
  return parts[0].trim()
}

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pl&format=json`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const json = await res.json()
    const r = json.results?.[0]
    if (!r) return null
    return { lat: r.latitude, lon: r.longitude }
  } catch { return null }
}

async function fetchForecast(lat: number, lon: number): Promise<DayForecast[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max')
  url.searchParams.set('forecast_days', '3')
  url.searchParams.set('timezone', 'Europe/Warsaw')
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error('Forecast fetch failed')
  const json = await res.json()
  const d = json.daily
  return (d.time as string[]).map((date: string, i: number) => ({
    date,
    code:        d.weather_code[i] as number,
    maxTemp:     Math.round(d.temperature_2m_max[i] as number),
    minTemp:     Math.round(d.temperature_2m_min[i] as number),
    precipProb:  Math.round(d.precipitation_probability_max[i] as number),
    windMax:     Math.round(d.wind_speed_10m_max[i] as number),
  }))
}

const DAY_NAMES = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']

export function ProjectWeatherWidget({ address }: { address?: string | null }) {
  const [forecast, setForecast]   = useState<DayForecast[] | null>(null)
  const [city, setCity]           = useState<string>('')
  const [error, setError]         = useState(false)
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (!address) return
    const cityName = extractCity(address)
    if (!cityName) return
    setCity(cityName)
    setLoading(true)
    setError(false)

    ;(async () => {
      try {
        const coords = await geocode(cityName)
        if (!coords) { setError(true); return }
        const days = await fetchForecast(coords.lat, coords.lon)
        setForecast(days)
      } catch { setError(true) }
      finally { setLoading(false) }
    })()
  }, [address])

  if (!address) return null

  const hasRisk = forecast?.some(d => decodeWeather(d.code).risk !== 'clear' || d.minTemp <= 0)

  return (
    <div style={{
      background: 'var(--color-surface-soft)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md, 10px)',
      padding: '14px 16px',
      fontSize: 13,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          🌤️ Pogoda dla budowy
          {city && (
            <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--color-text-muted)' }}>
              — {city}
            </span>
          )}
        </div>
        {hasRisk && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            background: 'rgba(239,68,68,0.12)', color: 'var(--color-error, #ef4444)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <AlertTriangle size={10} />Ryzyko
          </span>
        )}
      </div>

      {loading && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
          Ładowanie prognozy…
        </div>
      )}

      {error && !loading && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          Nie udało się pobrać prognozy dla: {city}
        </div>
      )}

      {forecast && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {forecast.map((day, i) => {
            const w = decodeWeather(day.code)
            const Icon = w.icon
            const isFrost = day.minTemp <= 0
            return (
              <div
                key={day.date}
                style={{
                  background: riskBg(isFrost ? 'danger' : w.risk),
                  border: `1px solid ${riskColor(isFrost ? 'danger' : w.risk)}30`,
                  borderRadius: 8,
                  padding: '8px 6px',
                  textAlign: 'center',
                }}
              >
                {/* Day label */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  {i === 0 ? 'Dziś' : i === 1 ? 'Jutro' : DAY_NAMES[new Date(day.date).getDay()]}
                </div>

                {/* Icon */}
                <Icon size={20} style={{ color: riskColor(isFrost ? 'danger' : w.risk), margin: '0 auto 4px' }} />

                {/* Label */}
                <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginBottom: 6, lineHeight: 1.3 }}>
                  {isFrost ? 'Mróz!' : w.label}
                </div>

                {/* Temp */}
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  {day.maxTemp}° / {day.minTemp}°
                </div>

                {/* Risk badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {day.precipProb >= 40 && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-info)', background: 'rgba(96,165,250,0.12)', borderRadius: 4, padding: '1px 4px' }}>
                      💧 {day.precipProb}%
                    </span>
                  )}
                  {day.windMax >= 40 && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-warning)', background: 'rgba(245,158,11,0.12)', borderRadius: 4, padding: '1px 4px' }}>
                      💨 {day.windMax} km/h
                    </span>
                  )}
                  {isFrost && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-error)', background: 'rgba(239,68,68,0.12)', borderRadius: 4, padding: '1px 4px' }}>
                      🧊 Mróz
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {forecast && (
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--color-text-muted)' }}>
          Źródło: open-meteo.com · odświeżane przy każdym otwarciu
        </div>
      )}
    </div>
  )
}
