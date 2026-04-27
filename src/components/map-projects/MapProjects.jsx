import React from 'react'
import { useHistory } from 'react-router-dom'
import { useTranslation } from 'react-i18next';

import moment from 'moment'
import reject from 'lodash/reject'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import ListItemText from '@mui/material/ListItemText'
import AddIcon from '@mui/icons-material/Add'
import times from 'lodash/times'
import APIService from '../../services/APIService'
import { getCurrentUser } from '../../common/utils'
import OwnerIcon from '../common/OwnerIcon'
import NoResults from '../search/NoResults';
import MapProjectDeleteConfirmDialog from './MapProjectDeleteConfirmDialog';

const MapProjects = () => {
  const { t } = useTranslation();
  const history = useHistory()

  const user = getCurrentUser()
  const [loading, setLoading] = React.useState([])
  const [projects, setProjects] = React.useState([])
  const [deleteProject, setDeleteProject] = React.useState(null)

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

  const onProjectDelete = success => {
    if(success) {
      setProjects(reject(projects, {id: deleteProject.id}))
    }
    setDeleteProject(null)
  }

  const onCopyClick = (event, project) => {
    event.preventDefault()
    event.stopPropagation()
    if(project?.url) {
      history.push(`/map-projects/new?templateFrom=${encodeURIComponent(project.url)}`)
    }
  }

  const isSplitView = false
  const loaded = loading.length === 2
  return (
    <div className='col-xs-12 padding-0' style={{borderRadius: '10px'}}>
      <Paper component="div" className={isSplitView ? 'col-xs-6 split padding-0' : 'col-xs-12 split padding-0'} sx={{boxShadow: 'none', p: 0, backgroundColor: 'white', borderRadius: '10px', border: 'solid 0.3px', borderColor: 'surface.nv80', minHeight: 'calc(100vh - 100px) !important'}}>
        <Paper component="div" className='col-xs-12' sx={{backgroundColor: 'surface.main', boxShadow: 'none', padding: '16px', borderRadius: '10px 10px 0 0'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <Typography component='span' sx={{fontSize: '28px', color: 'surface.dark', fontWeight: 600, display: 'flex', alignItems: 'center'}}>
              {t('map_project.mapping_projects')}
            </Typography>
            <Button variant='contained' color='primary' startIcon={<AddIcon />} href='#/map-projects/new' sx={{textTransform: 'none'}}>
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
                        <span style={{display: 'flex', alignItems: 'center'}}>
                          <Button size='small' variant='contained' color='secondary' sx={{margin: '0 4px', textTransform: 'none'}} onClick={event => onCopyClick(event, project)}>
                            {t('map_project.create_similar')}
                          </Button>
                          <Button size='small' color='error' variant='text' sx={{margin: '0 4px', textTransform: 'none'}} onClick={() => setDeleteProject(project)}>
                            {t('common.delete')}
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Paper>
      {
        deleteProject?.id &&
          <MapProjectDeleteConfirmDialog open={Boolean(deleteProject?.id)} onClose={onProjectDelete} project={deleteProject} />
      }
    </div>
  )
}

export default MapProjects;
