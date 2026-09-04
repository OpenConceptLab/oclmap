import React from 'react';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import LanguageIcon from '@mui/icons-material/Language';
import ProfileIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import HelpIcon from '@mui/icons-material/HelpCenterOutlined';
import ChatIcon from '@mui/icons-material/ForumOutlined';
import CommunityIcon from '@mui/icons-material/GroupsOutlined';
import find from 'lodash/find';
import { getCurrentUser, logoutUser, isLoggedIn, getLoginURL, getRegisterURL, toV3URL } from '../../common/utils'
import { LANGUAGES } from '../../common/constants';
import Button from '../common/Button';
import Link from '../common/Link';
import Drawer from '../common/Drawer';
import UserProfileButton from './UserProfileButton';
import CloseIconButton from '../common/CloseIconButton';

const UserMenu = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation()
  const [languageOpen, setLanguageOpen] = React.useState(false)
  const selectedLanguage = find(LANGUAGES, {locale: i18n.language})
  const authenticated = isLoggedIn()
  const user = getCurrentUser()
  const onLanguageSelect = locale => {
    i18n.changeLanguage(locale)
    moment.locale(locale)
    setLanguageOpen(false)
  }
  return (
    <Drawer isOpen={isOpen} onClose={onClose}>
      <div className='col-xs-12' style={{padding: '15px'}}>
        <div className='col-xs-12' style={{padding: '8px 0'}}>
          {
            authenticated &&
              <React.Fragment>
                <div className='col-xs-2 padding-0'>
                  <UserProfileButton sx={{p: user?.logo_url ? 0 : 1}} />
                </div>
                <div className='col-xs-9 padding-0'>
                  <div className='col-xs-12 padding-0'>
                    <b>{user?.username}</b>
                  </div>
                  <div className='col-xs-12 padding-0'>
                    {user?.name}
                  </div>
                </div>
              </React.Fragment>
          }
          <div className='col-xs-1 padding-0' style={{float: 'right'}}>
            <CloseIconButton onClick={onClose} />
          </div>
        </div>
        <div className='col-xs-12 padding-0'>
          {
            authenticated ?
              <List>
                <ListItemButton sx={{p: 1, borderRadius: '100px'}} component='a' className='no-anchor-styles' href={toV3URL(user?.url)} onClick={onClose} disabled={!user?.url} selected={location.pathname === user?.url}>
                  <ListItemIcon sx={{minWidth: 'auto', paddingRight: '14px'}}>
                    <ProfileIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('user.my_profile')} />
                </ListItemButton>
              </List> :
              <div className='col-xs-12 padding-0' style={{marginBottom: '24px'}}>
              <Button
                className='no-anchor-styles'
                label={t('auth.sign_in')}
                sx={{ backgroundColor: 'surface.s90', maxWidth: '100%', minWidth: '92px' }}
                href='#'
                component='a'
                onClick={e => { e.preventDefault(); getLoginURL(window.location.href).then(url => { window.location.href = url }) }}
              />
              <Link
                sx={{fontSize: '14px', marginLeft: '16px'}}
                label={t('auth.register')}
                href='#'
                onClick={e => { e.preventDefault(); getRegisterURL().then(url => { window.location.href = url }) }}
              />
            </div>
          }
        </div>
        <Divider style={{width: '100%'}} />
        <div className='col-xs-12 padding-0'>
          <List>
            <ListItemButton sx={{p: 1, borderRadius: '100px'}} onClick={() => setLanguageOpen(!languageOpen)}>
              <ListItemIcon sx={{minWidth: 'auto', paddingRight: '14px'}}>
                <LanguageIcon />
              </ListItemIcon>
              <ListItemText primary={selectedLanguage.name} secondary={t('common.language')} />
              {languageOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={languageOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {
                  LANGUAGES.map(lang => (
                    <ListItemButton  sx={{ pl: 5.75, borderRadius: '100px' }} selected={lang.locale === selectedLanguage.locale} key={lang.locale} onClick={() => onLanguageSelect(lang.locale)}>
                      <ListItemText primary={lang.locale.toUpperCase()} secondary={lang.name} />
                    </ListItemButton>
                  ))
                }
              </List>
            </Collapse>
            <ListItemButton component='a' className='no-anchor-styles' sx={{p: 1, borderRadius: '100px'}} href={toV3URL(user?.url + 'settings')} onClick={onClose} disabled={!user?.url}>
              <ListItemIcon sx={{minWidth: 'auto', paddingRight: '14px'}}>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary={t('common.settings')} />
            </ListItemButton>
          </List>
        </div>
        <Divider style={{width: '100%'}} />
        <div className='col-xs-12 padding-0'>
          <List>
            <ListItemButton sx={{p: 1, borderRadius: '100px'}} component='a' className='no-anchor-styles' href='https://openconceptlab.org' target='_blank' rel='noopener noreferrer'>
              <ListItemIcon sx={{minWidth: 'auto', paddingRight: '14px'}}>
                <CommunityIcon />
              </ListItemIcon>
              <ListItemText primary={t('common.community_website')} />
            </ListItemButton>
            <ListItemButton sx={{p: 1, borderRadius: '100px'}} component='a' className='no-anchor-styles' href='https://docs.openconceptlab.org' target='_blank' rel='noopener noreferrer'>
              <ListItemIcon sx={{minWidth: 'auto', paddingRight: '14px'}}>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText primary={t('common.help_and_documentation')} />
            </ListItemButton>
            <ListItemButton sx={{p: 1, borderRadius: '100px'}} component='a' className='no-anchor-styles' href='https://chat.openconceptlab.org/' target='_blank' rel='noopener noreferrer'>
              <ListItemIcon sx={{minWidth: 'auto', paddingRight: '14px'}}>
                <ChatIcon />
              </ListItemIcon>
              <ListItemText primary={t('common.chat')} />
            </ListItemButton>
          </List>
        </div>
        <Divider style={{width: '100%'}} />
        {
          authenticated &&
            <div className='col-xs-12 padding-0' style={{marginTop: '24px'}}>
              <Button label={t('auth.sign_out')} sx={{ bgcolor: 'primary.dark', maxWidth: '100%' }} onClick={() => logoutUser()} />
            </div>
        }
      </div>
    </Drawer>
  )
}

export default UserMenu
