// Calls the server. Always resolves; never throws.
//   ok:    { ok: true,  status, data }
//   error: { ok: false, status, error, data }   (status 0 means the server could not be reached)
export async function request(method, url, body) {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      // The x-dsp header is checked by the server to block cross-site requests.
      headers: { 'content-type': 'application/json', 'x-dsp': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    let data = null
    try { data = await res.json() } catch { /* not JSON */ }
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error || `Request failed (${res.status}).`, data }
    }
    return { ok: true, status: res.status, data: data ?? {} }
  } catch {
    return { ok: false, status: 0, error: 'Cannot reach the server. Check your internet connection.', data: null }
  }
}
