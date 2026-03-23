import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { apiRequest } from './api.js'

const HOSPITAL_COORDINATES = {
  'ST. JUDE': { lat: 8.15514, lng: 125.12983 },
  'SIMBULAN SNGH': { lat: 7.68181, lng: 124.99663 },
  LVGHI: { lat: 7.90809, lng: 125.09225 },
  VPGHI: { lat: 7.91491, lng: 125.09202 },
  MPGHI: { lat: 8.14901, lng: 125.13193 },
  AMCV: { lat: 7.91255, lng: 125.09233 },
}

const DEFAULT_THRESHOLDS = {
  greenMin: 50,
  yellowMin: 20,
}

function getStatus(totalUnits) {
  if (totalUnits >= DEFAULT_THRESHOLDS.greenMin) {
    return { key: 'green', label: 'Sufficient supply', color: '#22c55e' }
  }
  if (totalUnits >= DEFAULT_THRESHOLDS.yellowMin) {
    return { key: 'yellow', label: 'Low supply', color: '#eab308' }
  }
  return { key: 'red', label: 'Critical / Almost empty', color: '#ef4444' }
}

function createStatusIconWithSelection(color, isSelected) {
  return L.divIcon({
    className: '',
    iconSize: [26, 36],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
    html: `
      <svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgba(15,23,42,0.35)" />
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M13 0C7.477 0 3 4.477 3 10c0 2.612 0.86 4.71 2.22 6.66 1.36 1.95 3.165 3.7 4.87 5.806C11.446 24.4 12.29 25.53 13 26.8c.71-1.27 1.554-2.4 2.91-4.334 1.705-2.106 3.51-3.856 4.87-5.806C22.14 14.71 23 12.612 23 10 23 4.477 18.523 0 13 0z" fill="${color}" ${
            isSelected ? 'stroke="#0f172a" stroke-opacity="0.55" stroke-width="1.5"' : ''
          }/>
          ${
            isSelected
              ? `<circle cx="13" cy="10" r="7" fill="none" stroke="#0f172a" stroke-opacity="0.65" stroke-width="2" />`
              : ''
          }
          <circle cx="13" cy="10" r="${isSelected ? 6 : 5}" fill="white" fill-opacity="0.92" />
        </g>
      </svg>
    `,
  })
}

function FitBoundsToMarkers({ markers }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !markers.length) return

    const latLngs = markers.map((m) => [m.lat, m.lng])
    map.fitBounds(latLngs, { padding: [40, 40] })
  }, [map, markers])

  return null
}

function normalizeName(name) {
  return (name || '').trim().toUpperCase()
}

function FlyToSelectedHospital({ selectedHospital, selectedHospitalId, markerRefs }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedHospital) return
    if (!map) return

    const targetLatLng = [selectedHospital.lat, selectedHospital.lng]

    const openSelectedPopup = () => {
      const marker = markerRefs.current[selectedHospitalId]
      if (!marker) return
      marker.openPopup()
    }

    // Smooth transition, then open the popup card at the focused marker.
    map.once('moveend', openSelectedPopup)
    map.flyTo(targetLatLng, 15, { duration: 1.2 })

    return () => {
      map.off('moveend', openSelectedPopup)
    }
  }, [map, markerRefs, selectedHospital, selectedHospitalId])

  return null
}

function HospitalSupplyMap() {
  const [hospitals, setHospitals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [selectedHospitalId, setSelectedHospitalId] = useState(null)
  const markerRefs = useRef({})

  useEffect(() => {
    let isMounted = true

    const loadHospitals = async () => {
      try {
        setIsLoading(true)
        setError('')
        const data = await apiRequest('/api/admin/hospitals')

        if (!isMounted) return

        const allowedNames = Object.keys(HOSPITAL_COORDINATES)

        const baseHospitals = data
          .map((h) => {
            const normalized = normalizeName(h.hospital_name || h.hospitalName)
            const matchingKey =
              allowedNames.find((key) => normalized.includes(key)) || normalized

            const coords = HOSPITAL_COORDINATES[matchingKey]
            if (!coords) return null

            return {
              id: h.id,
              name: h.hospital_name || h.hospitalName || matchingKey,
              lat: coords.lat,
              lng: coords.lng,
            }
          })
          .filter(Boolean)

        const enriched = await Promise.all(
          baseHospitals.map(async (h) => {
            try {
              const inventory = await apiRequest(`/api/admin/inventory?hospitalId=${h.id}`)

              const totals = inventory.reduce(
                (acc, row) => {
                  const status = row.status
                  const available =
                    row.available_units ?? row.availableUnits ?? row.units ?? 0

                  if (status === 'expired' || available <= 0) {
                    return acc
                  }

                  const component =
                    row.component_type || row.componentType || 'whole_blood'

                  if (component === 'platelets') {
                    acc.platelets += available
                  } else if (component === 'plasma') {
                    acc.plasma += available
                  } else {
                    acc.wholeBlood += available
                  }

                  return acc
                },
                { wholeBlood: 0, platelets: 0, plasma: 0 },
              )

              const totalUnits =
                totals.wholeBlood + totals.platelets + totals.plasma
              const status = getStatus(totalUnits)

              return {
                ...h,
                totalUnits,
                wholeBloodUnits: totals.wholeBlood,
                plateletUnits: totals.platelets,
                plasmaUnits: totals.plasma,
                status,
              }
            } catch {
              const totalUnits = 0
              const status = getStatus(totalUnits)

              return {
                ...h,
                totalUnits,
                wholeBloodUnits: 0,
                plateletUnits: 0,
                plasmaUnits: 0,
                status,
              }
            }
          }),
        )

        setHospitals(enriched)
        setLastUpdated(new Date())
      } catch (err) {
        console.error('Failed to load hospitals for map', err)
        if (isMounted) {
          setError(err.message || 'Failed to load hospital supply data')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadHospitals()

    return () => {
      isMounted = false
    }
  }, [])

  const markers = useMemo(
    () =>
      hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        totalUnits: h.totalUnits,
        wholeBloodUnits: h.wholeBloodUnits ?? 0,
        plateletUnits: h.plateletUnits ?? 0,
        plasmaUnits: h.plasmaUnits ?? 0,
        status: h.status,
      })),
    [hospitals],
  )

  const selectedHospital = useMemo(
    () => markers.find((m) => m.id === selectedHospitalId) || null,
    [markers, selectedHospitalId],
  )

  const center = markers.length
    ? [markers[0].lat, markers[0].lng]
    : [14.5995, 120.9842]

  return (
    <div className="relative flex h-[min(520px,70vh)] min-h-[260px] w-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 sm:h-[520px] sm:min-h-[520px]">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Supply Mapping</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Live overview of partner hospital blood stock levels.
          </p>
        </div>
        {lastUpdated && (
          <p className="text-[11px] text-slate-400">
            Last updated{' '}
            {lastUpdated.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <p className="text-xs text-slate-500">Loading hospital supply map...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 px-4 text-center">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {markers.length > 0 && <FitBoundsToMarkers markers={markers} />}

          {markers.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={createStatusIconWithSelection(marker.status.color, marker.id === selectedHospitalId)}
              ref={(instance) => {
                if (instance) {
                  markerRefs.current[marker.id] = instance
                } else {
                  delete markerRefs.current[marker.id]
                }
              }}
              eventHandlers={{
                click: () => setSelectedHospitalId(marker.id),
              }}
            >
              <Popup autoPan={false}>
                <div className="space-y-1 text-xs">
                  <p className="text-sm font-semibold text-slate-900">{marker.name}</p>
                  <p className="text-slate-700">
                    Total units:{' '}
                    <span className="font-semibold">{marker.totalUnits}</span>
                  </p>
                  <div className="mt-1 space-y-0.5 text-slate-700">
                    <p>
                      Whole blood:{' '}
                      <span className="font-semibold">
                        {marker.wholeBloodUnits}
                      </span>
                    </p>
                    <p>
                      Platelets:{' '}
                      <span className="font-semibold">
                        {marker.plateletUnits}
                      </span>
                    </p>
                    <p>
                      Plasma:{' '}
                      <span className="font-semibold">
                        {marker.plasmaUnits}
                      </span>
                    </p>
                  </div>
                  <p className="flex items-center gap-1 text-slate-700">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: marker.status.color }}
                    ></span>
                    <span>{marker.status.label}</span>
                  </p>
                  {lastUpdated && (
                    <p className="text-[11px] text-slate-500">
                      Last updated{' '}
                      {lastUpdated.toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          <FlyToSelectedHospital
            selectedHospital={selectedHospital}
            selectedHospitalId={selectedHospitalId}
            markerRefs={markerRefs}
          />
        </MapContainer>

        <div className="pointer-events-none absolute bottom-3 left-3 z-1000 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-sm ring-1 ring-slate-200">
          <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-black">
            Supply Status
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>High : 50+ units</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span>Moderate : 20–49 units</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>Low : 0–19 units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hospital quick-select buttons */}
      <div className="flex-none border-t border-slate-100 bg-white px-3 py-3 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Hospitals
          </p>
          {selectedHospital ? (
            <span className="text-[11px] font-semibold text-slate-700">
              Selected: <span style={{ color: selectedHospital.status.color }}>{selectedHospital.name}</span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">Click a hospital to focus the map</span>
          )}
        </div>

        <div className="max-h-[140px] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {markers.map((marker) => {
              const isSelected = marker.id === selectedHospitalId
              return (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() => setSelectedHospitalId(marker.id)}
                  className={[
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold shadow-sm transition',
                    'focus:outline-none focus:ring-2 focus:ring-red-500/25',
                    'hover:bg-slate-50 active:bg-slate-100',
                    isSelected ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200',
                  ].join(' ')}
                  style={isSelected ? { borderColor: marker.status.color } : undefined}
                  aria-pressed={isSelected}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: marker.status.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">{marker.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HospitalSupplyMap

