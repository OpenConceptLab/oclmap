import React from 'react';
import { getCurrentUser, hasTermBrowser, toV3URL } from '../../common/utils';
import MapProjects from './MapProjects';

const MapProjectsRedirect = props => {
  const user = getCurrentUser()
  // A refused new project lands here with its reason in location.state. MapProjects
  // shows that reason and clears the state, so the choice to stay is kept for this visit.
  const [blockedNewProject] = React.useState(() => Boolean(props.location?.state?.newProjectBlock))
  const redirect = Boolean(user?.url) && !blockedNewProject && hasTermBrowser()

  React.useEffect(() => {
    if(redirect)
      window.location.replace(toV3URL(`${user.url}map-projects`))
  }, [redirect])

  return redirect ? null : <MapProjects />
}

export default MapProjectsRedirect
