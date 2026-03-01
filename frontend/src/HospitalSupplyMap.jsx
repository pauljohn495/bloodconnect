import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { apiRequest } from './api.js'

const HOSPITAL_COORDINATES = {
  'ST. JUDE': { lat: 14.5995, lng: 120.9842 },
  'SIMBULAN SNGH': { lat: 14.5958, lng: 120.9721 },
  LVGHI: { lat: 14.61, lng: 120.99 },
  VPGHI: { lat: 14.605, lng: 120.98 },
  MPGHI: { lat: 14.59, lng: 120.99 },
  AMCV: { lat: 14.6, lng: 120.97 },
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

function createStatusIcon(color) {
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
          <path d="M13 0C7.477 0 3 4.477 3 10c0 2.612 0.86 4.71 2.22 6.66 1.36 1.95 3.165 3.7 4.87 5.806C11.446 24.4 12.29 25.53 13 26.8c.71-1.27 1.554-2.4 2.91-4.334 1.705-2.106 3.51-3.856 4.87-5.806C22.14 14.71 23 12.612 23 10 23 4.477 18.523 0 13 0z" fill="${color}" />
          <circle cx="13" cy="10" r="5" fill="white" fill-opacity="0.9" />
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

function HospitalSupplyMap() {
  const [hospitals, setHospitals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

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

  const center = markers.length
    ? [markers[0].lat, markers[0].lng]
    : [14.5995, 120.9842]

  return (
    <div className="relative flex h-[520px] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
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
              icon={createStatusIcon(marker.status.color)}
            >
              <Popup>
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
        </MapContainer>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-sm ring-1 ring-slate-200">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Supply Status
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Green: 50+ units</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span>Yellow: 20–49 units</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>Red: 0–19 units</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HospitalSupplyMap

