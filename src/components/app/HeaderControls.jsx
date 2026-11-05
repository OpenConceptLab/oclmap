import React from 'react';
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import UserMenu from '../users/UserMenu';
import UserProfileButton from '../users/UserProfileButton';
import AddMenuList from '../users/AddMenuList'
import HeaderSearch from './HeaderSearch'
import { isLoggedIn } from '../../common/utils';


const HeaderControls = () => {
  const [userMenu, setUserMenu] = React.useState(false)
  const [addMenuAnchorEl, setAddMenuAnchorEl] = React.useState(null)

  const authenticated = isLoggedIn()

  return (
    <div className='col-xs-4 padding-0' style={{textAlign: 'right'}}>
      {authenticated && <HeaderSearch />}
      {
        authenticated &&
          <IconButton sx={{marginRight: '8px'}} aria-label='create' onClick={event => setAddMenuAnchorEl(event.currentTarget)}>
            <AddIcon />
          </IconButton>
      }
      <UserProfileButton onClick={() => setUserMenu(true)} />
      <UserMenu isOpen={userMenu} onClose={() => setUserMenu(false)} />
      {
        authenticated &&
          <AddMenuList open={Boolean(addMenuAnchorEl)} onClose={() => setAddMenuAnchorEl(null)} anchorEl={addMenuAnchorEl} />
      }
    </div>
  )
}

export default HeaderControls;
