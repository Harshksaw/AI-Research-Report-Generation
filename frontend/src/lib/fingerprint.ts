const STORAGE_KEY = '_device_id'

function djb2(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  }
  return h
}

function toHex(n: number): string {
  return n.toString(16).padStart(8, '0')
}

function canvasFp(): string {
  try {
    const c = document.createElement('canvas')
    c.width = 200; c.height = 40
    const ctx = c.getContext('2d')!
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#f60'
    ctx.fillRect(0, 0, 200, 40)
    ctx.fillStyle = '#069'
    ctx.font = '16px Arial,sans-serif'
    ctx.fillText('Cwm fjordbank glyphs vext quiz', 2, 28)
    ctx.fillStyle = 'rgba(102,204,0,0.8)'
    ctx.font = '12px Georgia,serif'
    ctx.fillText('fp_canvas', 100, 16)
    return toHex(djb2(c.toDataURL()))
  } catch {
    return '00000000'
  }
}

type ExtNav = Navigator & {
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; type?: string; saveData?: boolean }
  deviceMemory?: number
  userAgentData?: { brands?: { brand: string; version: string }[]; mobile?: boolean; platform?: string }
}

function webglInfo(): { vendor: string; renderer: string; version: string } {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl') as WebGLRenderingContext | null
    if (!gl) return { vendor: '', renderer: '', version: '' }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      vendor:   ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version:  gl.getParameter(gl.VERSION),
    }
  } catch {
    return { vendor: '', renderer: '', version: '' }
  }
}

export interface DeviceInfo {
  device_id:         string
  user_agent:        string
  platform:          string
  languages:         string
  timezone:          string
  timezone_offset:   number
  screen_width:      number
  screen_height:     number
  avail_width:       number
  avail_height:      number
  color_depth:       number
  pixel_ratio:       number
  touch_points:      number
  hardware_cores:    number | null
  device_memory_gb:  number | null
  connection_type:   string | null
  effective_type:    string | null
  downlink_mbps:     number | null
  rtt_ms:            number | null
  save_data:         boolean | null
  webgl_vendor:      string
  webgl_renderer:    string
  canvas_fp:         string
  ua_brands:         string | null
  ua_mobile:         boolean | null
  ua_platform:       string | null
  latitude:          number | null
  longitude:         number | null
  location_accuracy: number | null
}

function buildDeviceInfo(deviceId: string, geo?: GeolocationCoordinates | null): DeviceInfo {
  const nav = navigator as ExtNav
  const wgl = webglInfo()
  return {
    device_id:         deviceId,
    user_agent:        navigator.userAgent,
    platform:          navigator.platform,
    languages:         (navigator.languages ?? [navigator.language]).join(','),
    timezone:          Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_offset:   new Date().getTimezoneOffset(),
    screen_width:      screen.width,
    screen_height:     screen.height,
    avail_width:       screen.availWidth,
    avail_height:      screen.availHeight,
    color_depth:       screen.colorDepth,
    pixel_ratio:       window.devicePixelRatio,
    touch_points:      navigator.maxTouchPoints,
    hardware_cores:    navigator.hardwareConcurrency ?? null,
    device_memory_gb:  nav.deviceMemory ?? null,
    connection_type:   nav.connection?.type          ?? null,
    effective_type:    nav.connection?.effectiveType ?? null,
    downlink_mbps:     nav.connection?.downlink      ?? null,
    rtt_ms:            nav.connection?.rtt           ?? null,
    save_data:         nav.connection?.saveData      ?? null,
    webgl_vendor:      wgl.vendor,
    webgl_renderer:    wgl.renderer,
    canvas_fp:         canvasFp(),
    ua_brands:         nav.userAgentData?.brands?.map(b => `${b.brand}/${b.version}`).join(', ') ?? null,
    ua_mobile:         nav.userAgentData?.mobile  ?? null,
    ua_platform:       nav.userAgentData?.platform ?? null,
    latitude:          geo?.latitude  ?? null,
    longitude:         geo?.longitude ?? null,
    location_accuracy: geo?.accuracy  ?? null,
  }
}

function hashRaw(): string {
  const nav = navigator as ExtNav
  const wgl = webglInfo()
  const parts = [
    navigator.userAgent,
    navigator.language,
    (navigator.languages ?? []).join(','),
    navigator.platform,
    String(screen.width), String(screen.height),
    String(screen.availWidth), String(screen.availHeight),
    String(screen.colorDepth), String(screen.pixelDepth),
    String(navigator.hardwareConcurrency ?? ''),
    String(nav.deviceMemory ?? ''),
    String(navigator.maxTouchPoints),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(new Date().getTimezoneOffset()),
    String(window.devicePixelRatio),
    canvasFp(),
    wgl.vendor, wgl.renderer,
    nav.connection?.effectiveType ?? '',
  ]
  const raw = parts.join('||')
  const a = toHex(djb2(raw))
  const b = toHex(djb2(raw.split('').reverse().join('')))
  const c = toHex(djb2(raw.slice(raw.length >> 1)))
  return `fp_${a}${b}${c}`
}

export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = hashRaw()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

function tryGeo(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      ()    => resolve(null),
      { timeout: 4000, maximumAge: 300_000 },
    )
  })
}

export async function collectAndSendVisit(deviceId: string): Promise<void> {
  const geo  = await tryGeo()
  const info = buildDeviceInfo(deviceId, geo)
  await fetch('/api/visit', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
    body:    JSON.stringify(info),
  }).catch(() => {})
}
