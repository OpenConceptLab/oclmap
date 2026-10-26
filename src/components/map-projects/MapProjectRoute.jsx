import React from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import MapProject from './MapProject'
import { getPageKey } from './leaveGuard'

const MapProjectRoute = () => {
  const location = useLocation()
  const history = useHistory()
  const pageRef = React.useRef({key: null, path: null})
  if(pageRef.current.path !== location.pathname)
    pageRef.current = getPageKey(pageRef.current, location, history.action)
  return <MapProject key={pageRef.current.key} />
}

export default MapProjectRoute
