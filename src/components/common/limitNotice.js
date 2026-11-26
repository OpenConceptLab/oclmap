// A limit notice is a finished payload a connected service may add to a
// refusal (a 403 body's `notice`) or send from GET /capabilities/notices/
// (OpenConceptLab/ocl_online#702). Open code renders each field only if it was
// sent and works nothing out: no fraction, colour, date or wording is computed
// here. With no payload, LimitNotice shows the API's `detail` and nothing else.
// The same rules as TBv3's limitNotice.js. Import this file as limitNotice.js
// and the component as LimitNotice.jsx: on a case-insensitive disk the bare
// names resolve to the same file.
import { getRefusalOwner } from './limitAction.js'

export const NOTICE_KINDS = ['quota', 'cap', 'not_included', 'read_only']
export const NOTICE_TONES = ['info', 'warning', 'error']
const SCOPE_TYPES = ['account', 'organization']
const ACTION_KINDS = ['primary', 'secondary', 'text']
const TEXT_FIELDS = ['title', 'scope', 'reset', 'restricted', 'still_works', 'managed_by', 'tooltip']

// The write actions oclapi2 asks its capability policy about
// (core/capabilities/constants.py WRITE_ACTION_*), which a resource notice's
// `locks` may name
export const WRITE_ACTIONS = ['edit', 'publish', 'delete', 'make_private']

// oclapi2's refusal of a write to read-only content (OpenConceptLab/ocl_online#424)
export const READ_ONLY_ERROR_CODE = 'content_read_only'

const text = value => (typeof value === 'string' && value.trim()) ? value : null

// Only an absolute http(s) link is kept
export const safeURL = value => {
  if(typeof value !== 'string')
    return null
  let url
  try {
    url = new URL(value)
  } catch(_) {
    return null
  }
  return ['https:', 'http:'].includes(url.protocol) ? url.href : null
}

const pick = (value, allowed) => allowed.includes(value) ? value : null

const compactObject = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined))

const toMeter = meter => {
  if(!meter || typeof meter !== 'object')
    return null
  const label = text(meter.label)
  const fraction = Number.isFinite(meter.fraction) ? Math.max(0, Math.min(1, meter.fraction)) : null
  if(!label && fraction === null)
    return null
  return compactObject({label, fraction, tone: pick(meter.tone, NOTICE_TONES)})
}

const toLink = link => {
  if(!link || typeof link !== 'object')
    return null
  const label = text(link.label)
  const url = safeURL(link.url)
  return (label && url) ? {label, url} : null
}

// A button needs a label and a link; its kind falls back to secondary
const toAction = action => {
  const link = toLink(action)
  return link ? {...link, kind: pick(action.kind, ACTION_KINDS) || 'secondary'} : null
}

// The payload with only the fields this slot knows, each in the shape it
// renders. Null when there's no usable notice: it needs a title.
export const normalizeNotice = payload => {
  if(!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null
  const notice = {}
  TEXT_FIELDS.forEach(field => {
    notice[field] = text(payload[field])
  })
  if(!notice.title)
    return null
  notice.kind = pick(payload.kind, NOTICE_KINDS)
  notice.tone = pick(payload.tone, NOTICE_TONES)
  notice.scope_type = pick(payload.scope_type, SCOPE_TYPES)
  notice.meter = toMeter(payload.meter)
  notice.help = toLink(payload.help)
  const actions = Array.isArray(payload.actions) ? payload.actions.map(toAction).filter(Boolean) : []
  notice.actions = actions.length ? actions : null
  const locks = Array.isArray(payload.locks) ? [...new Set(payload.locks.filter(action => WRITE_ACTIONS.includes(action)))] : []
  notice.locks = locks.length ? locks : null
  notice.dismissible = payload.dismissible === true && notice.kind !== 'read_only' ? true : null
  return compactObject(notice)
}

// The body of a refusal, however the request was made: an axios error, a
// response, or the body itself
const getBody = value => value?.response?.data || value?.data || value

// The notice a refusal carries, or null
export const getNotice = value => {
  const body = getBody(value)
  return (body && typeof body === 'object') ? normalizeNotice(body.notice) : null
}

// The API's own reason, shown alone when there's no notice
export const getNoticeDetail = value => {
  const body = getBody(value)
  if(typeof body === 'string')
    return text(body)
  return text(body?.detail) || text(body?.error) || null
}

// The notices GET /capabilities/notices/ answers with, or none
export const getNotices = body => Array.isArray(body?.notices) ? body.notices.map(normalizeNotice).filter(Boolean) : []

// The way out (a primary action) leads: first in strips and inline notices,
// rightmost in dialogs
export const orderActions = (actions, size) => {
  const all = actions || []
  const wayFirst = [...all.filter(action => action.kind === 'primary'), ...all.filter(action => action.kind !== 'primary')]
  return size === 'dialog' ? wayFirst.reverse() : wayFirst
}

// The colour comes from the payload's tone (or its meter's), never from the numbers
export const getNoticeTone = notice => notice?.tone || notice?.meter?.tone || 'info'

// The icon follows the notice's kind, then its tone
export const getNoticeIcon = notice => {
  if(notice?.kind === 'read_only')
    return 'lock'
  if(notice?.kind === 'not_included')
    return 'info'
  return getNoticeTone(notice)
}


// The Mapper's part (OpenConceptLab/ocl_online#424, #701): a refusal's notice,
// its detail and whose limit it was, and the notices route for one project.

export const isReadOnlyRefusal = value => getBody(value)?.error_code === READ_ONLY_ERROR_CODE

// What a refusal shows: its notice, else its detail, and what the limit
// dialog it replaces asks the connected service about.
export const toLimitRefusal = value => {
  const body = getBody(value)
  return {
    errorCode: typeof body?.error_code === 'string' ? body.error_code : null,
    capability: typeof body?.capability === 'string' ? body.capability : null,
    owner: getRefusalOwner(body),
    notice: getNotice(body),
    detail: getNoticeDetail(body),
    readOnly: isReadOnlyRefusal(body),
  }
}

// A map project is read-only while its notice locks `edit`: every save of it
// is refused.
export const locksEditing = notice => Array.isArray(notice?.locks) && notice.locks.includes('edit')

// What the latest answer about a project from the notices route does: 'lock'
// (read-only, with its strip), 'show' (the strip only), 'clear' (an empty
// answer takes back what an earlier answer showed), or null while none has
// come (pending, failed, or no such route) and when there's nothing to change.
export const getResourceNoticeEffect = ({loaded, notice}, shownFromRoute) => {
  if(!loaded)
    return null
  if(notice)
    return locksEditing(notice) ? 'lock' : 'show'
  return shownFromRoute ? 'clear' : null
}

// A save refused as read-only locks the project until a newer word on it: an
// answer from the notices route asked for after the refusal (`requestedAt`
// and `refusedAt` from nextNoticeSequence()), that locks nothing.
// Orders the notices route's requests and the refusals that lock a project
// (supersedesRefusal): each call is later than the one before, where two
// clock readings can be equal.
let noticeSequence = 0
export const nextNoticeSequence = () => ++noticeSequence

export const supersedesRefusal = ({loaded, notice, requestedAt}, refusedAt) =>
  Boolean(loaded) && typeof refusedAt === 'number' && typeof requestedAt === 'number' && requestedAt > refusedAt && !locksEditing(notice)

// GET /capabilities/notices/?resource=<relative url> on the API: the notices
// for one repository or map project. An API without the route answers 404,
// and nothing shows.
export const getResourceNoticesRequest = ({baseURL, token, resource, lang}) => {
  if(!baseURL || !token || typeof resource !== 'string' || !resource)
    return null
  return {
    url: `${baseURL.replace(/\/+$/, '')}/capabilities/notices/`,
    params: {resource, lang},
    headers: {Authorization: `Token ${token}`},
  }
}

// Calls onReturn once each time the person comes back to this page from
// another tab or window: once it's shown and focused again, after it was
// hidden or lost focus. Returns the function that stops watching.
export const watchReturns = (win, doc, onReturn) => {
  let away = doc.visibilityState === 'hidden' || !doc.hasFocus()
  const leave = () => {
    away = true
  }
  // back once the page is both shown and focused: shown in a window that
  // isn't focused yet, it waits for the focus
  const back = () => {
    if(!away || doc.visibilityState === 'hidden' || !doc.hasFocus())
      return
    away = false
    onReturn()
  }
  const onVisibilityChange = () => doc.visibilityState === 'hidden' ? leave() : back()
  win.addEventListener('blur', leave)
  win.addEventListener('focus', back)
  doc.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    win.removeEventListener('blur', leave)
    win.removeEventListener('focus', back)
    doc.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
