import React from 'react'
import { useHistory } from 'react-router-dom'
import { useTranslation } from 'react-i18next';

import moment from 'moment'
import reject from 'lodash/reject'
import times from 'lodash/times'

import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'

import AddIcon from '@mui/icons-material/Add'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';

import APIService from '../../services/APIService'
import { getCurrentUser, getMapperPreview, getNewProjectBlockReason, refreshCurrentUserCapabilitiesCache } from '../../common/utils'

import OwnerIcon from '../common/OwnerIcon'
import NoResults from '../search/NoResults';
import MapProjectDeleteConfirmDialog from './MapProjectDeleteConfirmDialog';
import PreviewLimitDialog from './PreviewLimitDialog'
import QuotaDialog from '../common/QuotaDialog'

const NEW_PROJECT_BLOCK_ERROR_CODES = {access: 'mapper_access_denied', projects_not_entitled: 'mapper_projects_not_entitled'}

const MapProjects = () => {
  const { t } = useTranslation();
  const history = useHistory()

  const user = getCurrentUser()
  const [, setQuotaCacheVersion] = React.useState(0)
  const refreshMapperQuotaCache = React.useCallback(() => {
    refreshCurrentUserCapabilitiesCache(() => setQuotaCacheVersion(version => version + 1))
  }, [])
  React.useEffect(() => { refreshMapperQuotaCache() }, [])
  const [newProjectBlock, setNewProjectBlock] = React.useState(null)
  const [checkingNewProject, setCheckingNewProject] = React.useState(false)
  const [loading, setLoading] = React.useState([])
  const [projects, setProjects] = React.useState([])
  const [deleteProject, setDeleteProject] = React.useState(null)
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = React.useState(null)
  const [actionMenuProject, setActionMenuProject] = React.useState(null)

  const fetchProjects = () => {
    fetchUserProjects()
    fetchOrgProjects()
  }

  const fetchUserProjects = () => APIService.users(user.username).appendToUrl('map-projects/').get().then(handleProjectsResponse)

  const fetchOrgProjects = () => APIService.users(user.username).appendToUrl('orgs/map-projects/').get().then(handleProjectsResponse)

  const handleProjectsResponse = response => {
    const nextProjects = Array.isArray(response?.data) ? response.data : [];
    setProjects(prev => [...prev, ...nextProjects])
    setLoading(prev => [...prev, false])
  }


  React.useEffect(() => {
    fetchProjects()
  }, [])

  const onProjectDelete = (success) => {
    if(success === true) {
      setProjects(reject(projects, {id: deleteProject.id}))
    }
    setDeleteProject(null)
  }

  const startNewProject = templateURL => {
    const goToNewProject = () => history.push(templateURL ? `/map-projects/new?templateFrom=${encodeURIComponent(templateURL)}` : '/map-projects/new')
    const reasonFromCache = () => getNewProjectBlockReason(getMapperPreview())
    const showBlock = reason => setNewProjectBlock({reason, preview: getMapperPreview()})

    const cachedReason = reasonFromCache()
    if(cachedReason) {
      showBlock(cachedReason)
      return
    }
    setCheckingNewProject(true)
    refreshCurrentUserCapabilitiesCache(() => {
      setCheckingNewProject(false)
      const reason = reasonFromCache()
      if(reason)
        showBlock(reason)
      else
        goToNewProject()
    })
  }

  const onNewProjectClick = event => {
    event.preventDefault()
    if(!checkingNewProject)
      startNewProject()
  }

  const onCopyClick = (event, project) => {
    event.preventDefault()
    event.stopPropagation()
    if(project?.url && !checkingNewProject)
      startNewProject(project.url)
  }

  const openActionMenu = (event, project) => {
    event.preventDefault()
    event.stopPropagation()
    setActionMenuAnchorEl(event.currentTarget)
    setActionMenuProject(project)
  }

  const closeActionMenu = event => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    setActionMenuAnchorEl(null)
    setActionMenuProject(null)
  }

  const onMenuCopyClick = event => {
    if(actionMenuProject) {
      onCopyClick(event, actionMenuProject)
    }
    closeActionMenu(event)
  }

  const onMenuDeleteClick = event => {
    event.preventDefault()
    event.stopPropagation()
    setDeleteProject(actionMenuProject)
    closeActionMenu(event)
  }

  const isSplitView = false
  const loaded = loading.length === 2
  return (
    <div className='col-xs-12 padding-0' style={{borderRadius: '10px'}}>
      <Paper component="div" className={isSplitView ? 'col-xs-6 split padding-0' : 'col-xs-12 split padding-0'} sx={{boxShadow: 'none', p: 0, backgroundColor: 'white', borderRadius: '10px', border: 'solid 0.3px', borderColor: 'surface.nv80', minHeight: 'calc(var(--app-height) - 100px) !important'}}>
        <Paper component="div" className='col-xs-12' sx={{backgroundColor: 'surface.main', boxShadow: 'none', padding: '16px', borderRadius: '10px 10px 0 0'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <Typography component='span' sx={{fontSize: '28px', color: 'surface.dark', fontWeight: 600, display: 'flex', alignItems: 'center'}}>
              {t('map_project.mapping_projects')}
            </Typography>
            <Button
              variant='contained'
              color='primary'
              startIcon={<AddIcon />}
              href='#/map-projects/new'
              onClick={onNewProjectClick}
              sx={{textTransform: 'none'}}
            >
              {t('map_project.new_map_project')}
            </Button>
          </div>
        </Paper>
        <Paper component="div" className='col-xs-12' sx={{boxShadow: 'none', padding: '16px', borderRadius: '10px 10px 0 0'}}>
          <TableContainer sx={{ maxHeight: 'calc(100% - 250px)' }}>
            <Table stickyHeader sx={{ minWidth: 650 }} size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.id')}</TableCell>
                  <TableCell>{t('common.owner')}</TableCell>
                  <TableCell>{t('map_project.project_name')}</TableCell>
                  <TableCell>{t('common.created_by')}</TableCell>
                  <TableCell>{t('common.updated_by')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {
                  !loaded &&
                    times(5, i => (
                      <TableRow key={i}>
                        {
                          times(6, ri => (
                            <TableCell key={ri}>
                              <Skeleton height={70} sx={{'-webkit-transform': 'none', 'transform': 'none'}} />
                            </TableCell>
                          ))
                        }
                      </TableRow>
                    ))
                }
                {
                  loaded && projects.length === 0 &&
                    <TableRow>
                      <TableCell colSpan={6} align='center'>
                        <NoResults text={t('map_project.no_projects_found')} height='300px' />
                      </TableCell>
                    </TableRow>
                }
                {
                  projects.map(project => (
                    <TableRow
                      key={project.id}
                      onClick={() => history.push(project.url)}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&.MuiTableRow-hover:hover': {
                          backgroundColor: 'primary.95'
                        },
                      }}
                    >
                      <TableCell>{project.id}</TableCell>
                      <TableCell>
                        <span style={{display: 'flex', alignItems: 'center'}}>
                          <OwnerIcon sx={{fontSize: '1rem', marginRight: '8px'}} noTooltip ownerType={project.owner_type} />
                          {project.owner}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ListItemText primary={project.name} />
                      </TableCell>
                      <TableCell>
                        <ListItemText
                          primary={
                            <span style={{display: 'flex', alignItems: 'center'}}>
                              <OwnerIcon sx={{fontSize: '1rem', marginRight: '8px'}} noTooltip ownerType='user' />
                              {project.created_by}
                            </span>
                          }
                          secondary={moment(project.created_at).fromNow()}
                        />
                      </TableCell>
                      <TableCell>
                        <ListItemText
                          primary={
                            <span style={{display: 'flex', alignItems: 'center'}}>
                              <OwnerIcon sx={{fontSize: '1rem', marginRight: '8px'}} noTooltip ownerType='user' />
                              {project.updated_by}
                            </span>
                          }
                          secondary={moment(project.updated_at).fromNow()}
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Tooltip title={t('common.more_actions')}>
                          <IconButton
                            color='secondary'
                            size='small'
                            aria-label={t('common.more_actions')}
                            aria-haspopup='menu'
                            aria-controls={actionMenuAnchorEl ? 'map-project-actions-menu' : undefined}
                            aria-expanded={actionMenuAnchorEl ? 'true' : undefined}
                            onClick={event => openActionMenu(event, project)}
                          >
                            <MoreVertIcon fontSize='small' />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
          <Menu
            id='map-project-actions-menu'
            anchorEl={actionMenuAnchorEl}
            open={Boolean(actionMenuAnchorEl)}
            onClose={closeActionMenu}
            onClick={event => event.stopPropagation()}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={onMenuCopyClick}>
              <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
              <ListItemText>{t('map_project.create_similar')}</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={onMenuDeleteClick} sx={{color: 'error.main'}}>
              <ListItemIcon sx={{ color: 'error.main' }}><DeleteOutlined fontSize="small" /></ListItemIcon>
              <ListItemText>{t('common.delete')}</ListItemText>
            </MenuItem>
          </Menu>
        </Paper>
      </Paper>
      {
        newProjectBlock?.reason === 'projects' ?
          <QuotaDialog
            open
            onClose={() => setNewProjectBlock(null)}
            meter='projects'
            surface='new_project'
            usage={{used: newProjectBlock.preview.projects.used, limit: newProjectBlock.preview.projects.limit, period: 'one_time'}}
          /> :
          <PreviewLimitDialog
            open={Boolean(newProjectBlock)}
            onClose={() => setNewProjectBlock(null)}
            errorCode={NEW_PROJECT_BLOCK_ERROR_CODES[newProjectBlock?.reason]}
          />
      }
      {
        deleteProject?.id &&
          <MapProjectDeleteConfirmDialog open={Boolean(deleteProject?.id)} onClose={onProjectDelete} onDeleted={refreshMapperQuotaCache} project={deleteProject} />
      }
    </div>
  )
}

export default MapProjects;
