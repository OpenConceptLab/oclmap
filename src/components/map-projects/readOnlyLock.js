import { getResourceNoticeEffect, nextNoticeSequence, supersedesRefusal } from '../common/limitNotice.js'

/**
 * A map project's read-only state (OpenConceptLab/ocl_online#424, #702) and
 * the strip at the top of the project. The API refuses every save of a
 * read-only project, so nothing autosaves or saves on leave while it is.
 *
 * It turns read-only on a refused save, or on the notices route's answer for
 * the project, and ends on a save that goes through, or on a newer answer
 * from the route that locks nothing. Created once per MapProject, like the
 * autosave scheduler:
 * - onChange({readOnly, strip}) on every change; strip is {notice, detail}
 *   or null;
 * - onLock() as it turns read-only: the pending autosave is dropped;
 * - onUnlock() as read-only ends, or a strip from the route is taken back:
 *   the edits kept back are queued;
 * - onRefused() after a refusal turned it read-only: a lookup of the route
 *   still in flight is asked again, since its answer can't end the refusal
 *   (useNoticeLookup's renew). With none in flight nothing is asked, so a
 *   route and a save that disagree can't keep retrying: the user's return asks.
 */
export const createReadOnlyLock = ({onChange, onLock, onUnlock, onRefused = () => {}, next = nextNoticeSequence}) => {
  let readOnly = false
  let strip = null
  // whether the notices route sent the strip: an empty answer takes it back
  let fromRoute = false
  // when a refusal last made it read-only (next()), or null: a route answer
  // asked for after it, that locks nothing, ends it (supersedesRefusal)
  let refusedAt = null
  // counts the times it turned read-only, so a save knows whether a lock came
  // after it was sent
  let generation = 0

  const tell = () => onChange({readOnly, strip})

  const enter = ({notice, detail}, byRoute = false) => {
    readOnly = true
    generation += 1
    fromRoute = byRoute
    refusedAt = byRoute ? null : next()
    strip = {notice, detail}
    tell()
    onLock()
    if(!byRoute)
      onRefused()
  }

  const end = () => {
    readOnly = false
    fromRoute = false
    refusedAt = null
    strip = null
    tell()
    onUnlock()
  }

  const leave = () => {
    if(readOnly)
      end()
  }

  // Takes back what the notices route showed: its strip, and the read-only
  // state it began.
  const clearRoute = () => {
    if(fromRoute)
      end()
  }

  // The route's latest answer (useResourceNotice): a read-only project shows
  // its strip and saves nothing; an empty answer takes back what an earlier
  // one showed; a pending or failed one changes nothing. An answer asked for
  // after a refused save, that locks nothing, ends that read-only state too.
  const applyAnswer = answer => {
    if(supersedesRefusal(answer, refusedAt))
      leave()
    const effect = getResourceNoticeEffect(answer, fromRoute)
    if(effect === 'lock')
      enter({notice: answer.notice}, true)
    else if(effect === 'clear')
      clearRoute()
    else if(effect === 'show') {
      clearRoute()
      if(!readOnly) {
        fromRoute = true
        strip = {notice: answer.notice}
        tell()
      }
    }
  }

  return {
    isReadOnly: () => readOnly,
    enter,
    leave,
    applyAnswer,
    // Taken as a save is sent: the lock it was sent under.
    stampSend: () => generation,
    // A save sent under `stamp` went through: onSaved() marks what it kept,
    // then read-only ends. Not while it turned read-only again after the save
    // was sent: that newer word stands, and what the save kept stays unsaved
    // until a save after it ends (its log can't be sent meanwhile).
    releaseAfterSave: (stamp, onSaved) => {
      if(readOnly && stamp !== generation)
        return
      onSaved()
      leave()
    },
  }
}
