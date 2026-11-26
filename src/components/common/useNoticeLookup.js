import React from 'react'

import { getNotices, nextNoticeSequence, watchReturns } from './limitNotice.js'

const PENDING = {loaded: false, notice: null}

// [answer, renew]: the latest answer about one resource from the notices route
// (OpenConceptLab/ocl_online#702), asked once per `key` with ask(): a promise
// of the route's response, or null when nothing can be asked. {loaded,
// notice, requestedAt}: loaded once the latest request is answered, with its
// first notice or none, and when it was asked for (nextNoticeSequence()); not
// while it waits, and never when the request fails. While `recheck` is true it
// is asked again each time the person comes back to the page: a notice's link
// can send them to another tab, where they may change what it says.
// renew() replaces a request still in flight with a new one, and does nothing
// when none is: a refusal that arrived meanwhile may be newer than its answer.
const useNoticeLookup = (key, ask, recheck) => {
  const [reply, setReply] = React.useState({key: null, ...PENDING})
  const [round, setRound] = React.useState(0)
  const inFlightRef = React.useRef(false)

  React.useEffect(() => {
    const request = ask()
    inFlightRef.current = Boolean(request)
    if(!request)
      return undefined
    // only this request's reply, while it's the latest
    let current = true
    const requestedAt = nextNoticeSequence()
    const settle = () => {
      if(current)
        inFlightRef.current = false
      return current
    }
    request
      .then(response => settle() && setReply({key, loaded: true, notice: getNotices(response?.data)[0] || null, requestedAt}))
      .catch(settle)
    return () => {
      current = false
    }
  }, [key, round])

  const askAgain = React.useCallback(() => setRound(value => value + 1), [])
  const renew = React.useCallback(() => inFlightRef.current && askAgain(), [askAgain])
  React.useEffect(() => recheck ? watchReturns(window, document, askAgain) : undefined, [recheck, askAgain])

  return [reply.key === key ? reply : PENDING, renew]
}

export default useNoticeLookup
