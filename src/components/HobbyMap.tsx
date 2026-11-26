import { useEffect, useMemo, useRef } from 'react';
import { AttributionControl, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowUpRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import type { Venue } from '../data/places';
import { yandexMapsUrl } from '../data/places';

function MapController({ places, selected }: { places: Venue[]; selected?: Venue }) {
  const map = useMap();
  const reduceMotion = useReducedMotion();
  const signature = places.map((place) => place.id).join('|');
  const applyViewRef = useRef<() => void>(() => {});
  // The view could not be applied because the map was hidden (e.g. "Список" tab on phones).
  const pendingViewRef = useRef(false);

  useEffect(() => {
    applyViewRef.current = () => {
      // Leaflet caches the container size; refresh it, because the map may have been hidden.
      map.invalidateSize({ pan: false });
      const size = map.getSize();
      if (!size.x || !size.y) {
        // A hidden map has a 0×0 size: flyTo/fitBounds would compute NaN coordinates and throw
        // "Invalid LatLng object: (NaN, NaN)", crashing the whole page. Apply once it is visible.
        pendingViewRef.current = true;
        return;
      }
      pendingViewRef.current = false;
      if (selected) {
        map.flyTo(selected.coords, Math.max(map.getZoom(), 13), {
          duration: reduceMotion ? 0 : 0.75,
          animate: !reduceMotion,
        });
        return;
      }
      if (places.length === 1) {
        map.setView(places[0].coords, 12, { animate: !reduceMotion });
      } else if (places.length > 1) {
        map.fitBounds(L.latLngBounds(places.map((place) => place.coords)), {
          padding: [48, 48],
          maxZoom: 12,
          animate: !reduceMotion,
        });
      }
    };
  });

  useEffect(() => {
    applyViewRef.current();
  }, [map, selected?.id, signature, reduceMotion]);

  // Re-measure the map when its container is shown or resized and apply a postponed view.
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      if (pendingViewRef.current) applyViewRef.current();
      else map.invalidateSize({ pan: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

type Props = {
  places: Venue[];
  selectedId: string | null;
  onSelect: (venue: Venue) => void;
  onOpen: (venue: Venue) => void;
  accent: string;
};

export default function HobbyMap({ places, selectedId, onSelect, onOpen, accent }: Props) {
  const selected = places.find((place) => place.id === selectedId);
  const icons = useMemo(() => new Map<string, L.DivIcon>(), []);

  const getIcon = (venue: Venue, index: number) => {
    const isSelected = venue.id === selectedId;
    const key = `${venue.id}-${index}-${isSelected}`;
    if (!icons.has(key)) {
      icons.set(key, L.divIcon({
        className: 'hobby-map-icon',
        html: `<span class="hobby-marker${isSelected ? ' is-selected' : ''}" style="--marker-color:${accent}"><span>${index + 1}</span></span>`,
        iconSize: [42, 48],
        iconAnchor: [21, 44],
      }));
    }
    return icons.get(key)!;
  };

  return (
    <div className="map-shell">
      <MapContainer center={[55.75, 37.62]} zoom={10} className="hobby-map" scrollWheelZoom={false} zoomControl attributionControl={false}>
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController places={places} selected={selected} />
        {places.map((venue, index) => (
          <Marker
            key={venue.id}
            position={venue.coords}
            icon={getIcon(venue, index)}
            zIndexOffset={venue.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(venue) }}
            title={venue.name}
          />
        ))}
      </MapContainer>
      {selected && (
        <button className="map-selected-card" onClick={() => onOpen(selected)}>
          <span>
            <small>{selected.district} · {selected.priceLabel}</small>
            <strong>{selected.name}</strong>
          </span>
          <span className="map-selected-arrow"><ArrowUpRight size={20} /></span>
        </button>
      )}
      <a
        className="map-external-link"
        href={selected ? yandexMapsUrl(selected) : 'https://yandex.ru/maps/213/moscow/'}
        target="_blank"
        rel="noreferrer"
      >
        Яндекс Карты <ArrowUpRight size={15} />
      </a>
    </div>
  );
}
