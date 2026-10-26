const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')
const SESSION_KEY = 'shockready.session'

function getSession() {
  try {
    const rawSession = sessionStorage.getItem(SESSION_KEY)
    return rawSession ? JSON.parse(rawSession) : null
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

function saveSession(session) {
  if (session?.access_token && session?.refresh_token) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

async function send(endpoint, options = {}, accessToken) {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken)

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })
  const result = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(
      result.message || result.error || `Request failed (${response.status})`
    )
    error.status = response.status
    throw error
  }

  return result
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null

  try {
    const result = await send('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refresh_token }),
    })
    saveSession(result.data.session)
    return result.data.session
  } catch (error) {
    if (error.status === 401) {
      saveSession(null)
      return null
    }
    throw error
  }
}

async function request(endpoint, options = {}) {
  const session = getSession()
  try {
    return await send(endpoint, options, session?.access_token)
  } catch (error) {
    if (error.status !== 401 || endpoint.startsWith('/auth/')) throw error

    const refreshedSession = await refreshSession(session)
    if (!refreshedSession) throw error
    return send(endpoint, options, refreshedSession.access_token)
  }
}

async function authenticate(endpoint, credentials) {
  const result = await send(endpoint, {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
  saveSession(result.data.session)
  return result
}

export const api = {
  hasSession: () => Boolean(getSession()?.access_token),
  signUp: (details) => authenticate('/auth/signup', details),
  signIn: (credentials) => authenticate('/auth/login', credentials),
  signOut: () => saveSession(null),
  getHealth: () => send('/health'),
  getMe: () => request('/auth/me'),
  registerOrganization: (organization) =>
    send('/organizations/register', {
      method: 'POST',
      body: JSON.stringify(organization),
    }),
  getPendingOrganizations: () => request('/organizations/pending'),
  updateOrganizationApproval: (id, status) =>
    request(`/organizations/${encodeURIComponent(id)}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getStaff: () => request('/staff'),
  createStaff: (staff) =>
    request('/staff', { method: 'POST', body: JSON.stringify(staff) }),
  deactivateStaff: (id) =>
    request(`/staff/${encodeURIComponent(id)}/deactivate`, { method: 'PATCH' }),
  createIncident: (incident) =>
    request('/incidents', {
      method: 'POST',
      body: JSON.stringify(incident),
    }),
  getMyIncidents: () => request('/incidents/mine'),
  getPublicIncidents: () => request('/incidents/public'),
  getIncidents: (filters = {}) => {
    const query = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value !== '' && value != null)
    )
    return request(`/incidents${query.size ? `?${query}` : ''}`)
  },
  getIncident: (id) => request(`/incidents/${encodeURIComponent(id)}`),
  updateIncidentStatus: (id, newStatus, notes) =>
    request(`/incidents/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ newStatus, notes }),
    }),
  verifyIncident: (id, decision, notes) =>
    request(`/incidents/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    }),
  assignIncident: (id, assignedStaffId, instructions) =>
    request(`/incidents/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedStaffId, instructions }),
    }),
  getMyAssignments: () => request('/incidents/assignments/mine'),
  acceptAssignment: (id) =>
    request(`/incidents/assignments/${encodeURIComponent(id)}/accept`, {
      method: 'PATCH',
    }),
  startIncidentResponse: (id) =>
    request(`/incidents/assignments/${encodeURIComponent(id)}/start`, {
      method: 'PATCH',
    }),
  createResourceDispatch: (incidentId, dispatch) =>
    request(`/incidents/${encodeURIComponent(incidentId)}/dispatches`, {
      method: 'POST',
      body: JSON.stringify(dispatch),
    }),
  updateResourceDispatchStatus: (id, status) =>
    request(`/incidents/dispatches/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  confirmResourceReceipt: (id, confirmation) =>
    request(`/incidents/dispatches/${encodeURIComponent(id)}/confirmations`, {
      method: 'POST',
      body: JSON.stringify(confirmation),
    }),
  getIncidentDispatchHistory: (incidentId) =>
    request(`/incidents/${encodeURIComponent(incidentId)}/dispatches`),
  getMyResourceDispatches: () => request('/incidents/dispatches/mine'),
}
