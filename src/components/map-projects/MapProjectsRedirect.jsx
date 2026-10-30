import React from 'react';
import { getCurrentUser, toV3URL } from '../../common/utils';
import MapProjects from './MapProjects';

const MapProjectsRedirect = props => {
  const user = getCurrentUser()
  const blockedNewProject = Boolean(props.location?.state?.newProjectBlock)
  const redirect = Boolean(user?.url) && !blockedNewProject

  React.useEffect(() => {
    if(redirect)
      window.location.replace(toV3URL(`${user.url}map-projects`))
  }, [redirect])

  return redirect ? null : <MapProjects />
}

export default MapProjectsRedirect
