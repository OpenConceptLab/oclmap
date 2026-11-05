import { RATE_LIMIT } from '../../services/capacity.js'

// Day limits can reopen tomorrow (ocl_issues#2865).
export const formatClockTime = (ms, { now = Date.now, format = (date, options) => date.toLocaleTimeString([], options) } = {}) => {
  const date = new Date(ms)
  return format(date, {
    hour: 'numeric', minute: '2-digit', second: '2-digit',
    ...(date.toDateString() === new Date(now()).toDateString() ? {} : {weekday: 'short'}),
  })
}

// wait is {limit, retryAt}; anything but a rate limit reads as a capacity wait (ocl_issues#2865).
export const getCapacityWaitLabel = (wait, { t, short = false, formatTime = formatClockTime } = {}) => {
  if(wait?.limit === RATE_LIMIT)
    return short ?
      t('map_project.rate_limited_short') :
      t('map_project.rate_limited', {time: formatTime(wait.retryAt)})
  return t(short ? 'map_project.waiting_for_capacity_short' : 'map_project.waiting_for_capacity')
}

// A capacity wait wins; between two rate-limit waits, the later retry.
export const mergeCapacityWaits = (a, b) => {
  if(!a || !b)
    return a || b
  if(a.limit !== RATE_LIMIT)
    return a
  if(b.limit !== RATE_LIMIT)
    return b
  return b.retryAt > a.retryAt ? b : a
}

/**
 * The row panel's progress chip: which of the row's algorithms is running or
 * still to run. {label: false} before the row has stages; no label once every
 * algorithm is done.
 *
 * capacityWait: a request for this row (an algorithm or its rerank) is waiting
 * out a busy server, which the chip says instead (ocl_issues#2849). A row the
 * server stayed too busy for (-4) asks for a retry: it wasn't run, it didn't
 * fail.
 */
export const getRowProgressLabel = (stageMap, algos, { t, capacityWait = false, throttle, formatTime = formatClockTime } = {}) => {
  if(stageMap === undefined)
    return {label: false}
  if(capacityWait)
    return {label: getCapacityWaitLabel(capacityWait, {t, formatTime}), status: 'capacity_wait'}
  if(!stageMap)
    return {label: 'Preparing...', status: 'partial'}
  const throttledLabel = () => throttle?.limit === RATE_LIMIT ?
    t('map_project.row_rate_limited', {time: formatTime(throttle.retryAt)}) : t('map_project.row_throttled')

  const stages = algos.map(k => stageMap[k.id]);

  if (!stages.length || stages.every(v => v === -1)) {
    return { label: 'Not started', status: 'idle' };
  }

  const runningIndex = stages.findIndex(v => v === 0);
  if (runningIndex !== -1) {
    return {
      label: `Running: ${algos[runningIndex].id}...`,
      status: 'running',
    };
  }

  // -3: the algorithm isn't available to this user, so there's nothing to wait for.
  if (stages.every(v => v === 1 || v === -3)) {
    // The candidates are in, but the server stayed too busy to rank them.
    if(stageMap.rerank === -4)
      return {label: throttledLabel(), status: 'throttled'}
    return true
  }

  const waitingIndex = stages.findIndex(v => v === -1)
  if(waitingIndex !== -1) {
    return {label: `Waiting: ${algos[waitingIndex].id}`, status: 'waiting'} // AutoMatch Bulk
  }

  if(stages.some(v => v === -4))
    return {label: throttledLabel(), status: 'throttled'}

  return { label: 'Partially completed', status: 'partial' };
}
