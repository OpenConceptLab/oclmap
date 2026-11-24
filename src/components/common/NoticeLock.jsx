import React from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import LockIcon from '@mui/icons-material/LockOutlined'

// Why the open map project's writes are locked: its read-only notice's tooltip,
// or null while nothing is locked (OpenConceptLab/ocl_online#424). Each control
// that writes the project reads it, as TBv3's NoticeLocks does for a
// repository's controls.
export const EditLockContext = React.createContext(null)

export const useEditLock = () => React.useContext(EditLockContext)

// A locked control is disabled and says why on hover. A disabled control emits
// no pointer events, so the tooltip goes on a wrapping span.
export const LockTooltip = ({ title, children, placement = 'bottom', display = 'inline-flex', style }) => title ?
  <Tooltip title={title} placement={placement}>
    <span style={{display, ...style}}>{children}</span>
  </Tooltip> :
  children

// A group of locked fields says why on hover over it, except over a button or
// link that still works (showing a token, closing a panel). Its wrapper has
// no box and is there whether or not the project is locked, so the fields lay
// out as without it and keep their state as a lock lands or ends.
export const LockedFields = ({ children }) => {
  const lock = useEditLock()
  const [overLocked, setOverLocked] = React.useState(false)
  const onMouseOver = event => lock && setOverLocked(!event.target.closest?.('button:not(:disabled), a[href]'))
  return (
    <Tooltip title={lock || ''} open={Boolean(lock) && overLocked} followCursor disableHoverListener disableFocusListener disableTouchListener>
      <span style={{display: 'contents'}} onMouseOver={onMouseOver} onMouseLeave={() => setOverLocked(false)}>{children}</span>
    </Tooltip>
  )
}

export const LockMark = ({ sx }) => <LockIcon fontSize='inherit' sx={{color: 'secondary.main', ...sx}} />

// An icon button's own icon, with the lock on its corner.
export const LockedIcon = ({ icon }) => (
  <Box component='span' sx={{position: 'relative', display: 'inline-flex'}}>
    {icon}
    <LockIcon sx={{position: 'absolute', right: -5, bottom: -4, fontSize: '13px', color: 'secondary.main', backgroundColor: 'white', borderRadius: '50%'}} />
  </Box>
)
