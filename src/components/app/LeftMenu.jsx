import React from 'react';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom';
import Typography from '@mui/material/Typography'
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderOpenIcon from '@mui/icons-material/FolderOutlined';
import CommunityIcon from '@mui/icons-material/GroupsOutlined';
import Divider from '@mui/material/Divider';
import map from 'lodash/map'
import { PRIMARY_COLORS } from '../../common/colors'
import { COMMUNITY_SITE_URL } from '../../common/constants'
import { getCurrentUser, refreshCurrentUserCache, getCurrentUserOrgs, hasTermBrowser, toV3URL } from '../../common/utils';
import Drawer from '../common/Drawer';
import OrgIcon from '../orgs/OrgIcon';
import EntityIcon from '../common/EntityIcon'
import { trayItems, isTrayItemSelected } from '../../common/navigation'
import { projectCount } from '../../common/mapProjects'
import APIService from '../../services/APIService'
import Button from '@mui/material/Button';


const TRAY_ICONS = {
  dashboard: selected => <DashboardIcon color={selected ? 'primary' : undefined} />,
  repos: selected => <FolderOpenIcon color={selected ? 'primary' : undefined} />,
  'map-projects': selected => <i style={{fontSize: '1.25rem', color: selected ? PRIMARY_COLORS.main : undefined}} className="fa-solid fa-diagram-project"></i>
}

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const LeftMenu = ({ isOpen, onClose }) => {
  const { t } = useTranslation()
  const location = useLocation()
  const user = getCurrentUser()
  const integrated = hasTermBrowser()

  const formatFollowing = following => map(following, 'object') || []

  const [mapProjectCount, setMapProjectCount] = React.useState(null)
  const [orgs, setOrgs] = React.useState(getCurrentUserOrgs())
  const [following, setFollowing] = React.useState(formatFollowing(user?.following))


  const fetchData = () => {
    refreshCurrentUserCache(response => {
      setOrgs(getCurrentUserOrgs())
      setFollowing(formatFollowing(response?.data?.following))
    })
  }

  React.useEffect(() => {
    if(isOpen && getCurrentUser()?.url)
      fetchData()
  }, [isOpen && user?.url])

  React.useEffect(() => {
    if(!isOpen || !user?.username)
      return
    let active = true
    Promise.all([
      APIService.users(user.username).appendToUrl('map-projects/').get(null, null, {limit: 1}, true),
      APIService.users(user.username).appendToUrl('orgs/map-projects/').get(null, null, {limit: 1}, true),
    ]).then(responses => {
      if(active)
        setMapProjectCount(projectCount(...responses))
    }).catch(() => {})
    return () => { active = false }
  }, [isOpen && user?.username])

  return (
    <Drawer isOpen={isOpen} onClose={onClose} anchor='left' bgColor='default.main'>
      <DrawerHeader>
        <Typography component="div" sx={{color: 'secondary.main', fontWeight: 'bold', minHeight: '56px !important'}}>
          {t('common.quick_links')}
        </Typography>
      </DrawerHeader>
      <List sx={{p: 0}}>
        {
          trayItems(user, true).filter(item => integrated || item.key === 'map-projects').map(tray => {
            const item = integrated ? tray : {...tray, path: '/map-projects'}
            const selected = isTrayItemSelected(item, location.pathname)
            return (
              <ListItem key={item.key} disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  onClick={onClose}
                  href={integrated ? toV3URL(item.path) : `#${item.path}`}
                  className='no-anchor-styles'
                  selected={selected}
                  sx={{
                    minHeight: 56,
                    justifyContent: 'initial',
                    px: 2,
                    borderRadius: '100px'
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 1.75,
                      justifyContent: 'center',
                    }}
                  >
                    {TRAY_ICONS[item.key](selected)}
                  </ListItemIcon>
                  <ListItemText primary={t(item.labelKey)} />
                  {
                    item.key === 'repos' &&
                      <span><b>{((user?.collections || 0) + (user?.sources + 0)).toLocaleString()}</b></span>
                  }
                  {
                    item.key === 'map-projects' && mapProjectCount !== null &&
                      <span><b>{mapProjectCount.toLocaleString()}</b></span>
                  }
                </ListItemButton>
              </ListItem>
            )
          })
        }
      </List>
      {integrated && (
        <>
      <Divider style={{width: '100%', marginTop: '16px'}} />
      <List sx={{maxHeight: '300px', overflow: 'auto', p: 0}} dense>
        <ListItem
          disablePadding
          sx={{ display: 'block', padding: 1, borderRadius: '100px' }}
          secondaryAction={
            <Button edge="end" aria-label={t('common.create')} variant='text' color='primary' href={toV3URL('/orgs/new')} onClick={onClose} sx={{textTransform: 'none'}}>
              <b>{t('common.create')}</b>
            </Button>
          }
        >
          <ListItemText
            primary={
              <Typography
                component="div"
                sx={{color: 'secondary.main', fontWeight: 'bold'}}>
                {t('org.my')}
              </Typography>
            }
          />
        </ListItem>
        {
          orgs.map(org => (
            <ListItem disablePadding sx={{ display: 'block', maxWidth: '336px' }} key={org.url}>
              <ListItemButton
                onClick={onClose}
                sx={{
                  minHeight: 56,
                  justifyContent: 'initial',
                  padding: '0px 16px',
                  borderRadius: '100px'
                }}
                href={toV3URL(org?.url)}
                className='no-anchor-styles'
                selected={location.pathname === org?.url}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 45,
                    mr: 1.75,
                    justifyContent: 'center',
                  }}
                >
                  <OrgIcon org={org} iconColor={location.pathname === org?.url ? 'primary' : undefined} noLink strict />
                </ListItemIcon>
                <ListItemText primary={org.name} />
              </ListItemButton>
            </ListItem>
          ))
        }
      </List>
      <Divider style={{width: '100%'}} />
      <List sx={{maxHeight: '300px', overflow: 'auto', p: 0}} dense>
        <ListItem
          disablePadding
          sx={{ display: 'block', padding: 1, borderRadius: '100px' }}
          secondaryAction={
            <span><b>{following?.length}</b></span>
          }>
          <ListItemText
            primary={
              <Typography
                component="div"
                sx={{color: 'secondary.main', fontWeight: 'bold'}}>
                {t('common.following')}
              </Typography>
            }
          />
        </ListItem>
        {
          following.map(followed => (
            <ListItem disablePadding sx={{ display: 'block', maxWidth: '336px' }} key={followed.url}>
              <ListItemButton
                onClick={onClose}
                sx={{
                  minHeight: 56,
                  justifyContent: 'initial',
                  padding: '0px 16px',
                  borderRadius: '100px'
                }}
                href={toV3URL(followed.url)}
                className='no-anchor-styles'
                selected={location.pathname === followed?.url}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 45,
                    mr: 1.75,
                    justifyContent: 'center',
                  }}
                >
                  <EntityIcon noLink strict entity={followed} isVersion={(followed?.short_code && followed?.version_url)} sx={{color: location.pathname === followed?.url ? 'primary.main' : 'secondary.main'}} />
                </ListItemIcon>
                <ListItemText primary={followed.name || followed.id} />
              </ListItemButton>
            </ListItem>
          ))
        }
      </List>
        </>
      )}
      <Divider style={{width: '100%', marginTop: 'auto'}} />
      <List sx={{p: 0}}>
        <ListItem disablePadding sx={{ display: 'block' }}>
          <ListItemButton
            onClick={onClose}
            href={COMMUNITY_SITE_URL}
            target='_blank'
            rel='noopener noreferrer'
            className='no-anchor-styles'
            sx={{
              minHeight: 56,
              justifyContent: 'initial',
              px: 2,
              borderRadius: '100px'
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: 1.75,
                justifyContent: 'center',
              }}
            >
              <CommunityIcon />
            </ListItemIcon>
            <ListItemText primary={t('common.community_website')} />
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  )
}

export default LeftMenu;
