/** Ray-casting point-in-polygon test. polygon: [{ lat, lng }, ...] (>= 3 points). */
export function isPointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
  const { latitude: y, longitude: x } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isValidGeoFence(geoFence) {
  if (geoFence == null) return true;
  if (!Array.isArray(geoFence)) return false;
  if (geoFence.length === 0) return true;
  if (geoFence.length < 3) return false;
  return geoFence.every(
    (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)),
  );
}
