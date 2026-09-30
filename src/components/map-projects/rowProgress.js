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
export const getRowProgressLabel = (stageMap, algos, { t, capacityWait = false } = {}) => {
  if(stageMap === undefined)
    return {label: false}
  if(capacityWait)
    return {label: t('map_project.waiting_for_capacity'), status: 'capacity_wait'}
  if(!stageMap)
    return {label: 'Preparing...', status: 'partial'}

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
    return true
  }

  const waitingIndex = stages.findIndex(v => v === -1)
  if(waitingIndex !== -1) {
    return {label: `Waiting: ${algos[waitingIndex].id}`, status: 'waiting'} // AutoMatch Bulk
  }

  if(stages.some(v => v === -4))
    return {label: t('map_project.row_throttled'), status: 'throttled'}

  return { label: 'Partially completed', status: 'partial' };
}
