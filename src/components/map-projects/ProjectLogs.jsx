import React from 'react'
import moment from 'moment'
import { useTranslation, Trans } from 'react-i18next'

import Timeline  from '@mui/lab/Timeline';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';

import OpenIcon from '@mui/icons-material/CropSquare';
import RepoIcon from '../repos/RepoIcon'
import HistoryIcon from '@mui/icons-material/ChangeHistory';
import DownloadIcon from '@mui/icons-material/Download';
import AutoMatchIcon from '@mui/icons-material/MotionPhotosAutoOutlined';
import StopIcon from '@mui/icons-material/Clear';

import map from 'lodash/map'
import orderBy from 'lodash/orderBy'
import startCase from 'lodash/startCase'

import { PRIMARY_COLORS } from '../../common/colors'
import { toV3URL } from '../../common/utils'
import CloseIconButton from '../common/CloseIconButton';


const ProjectLogs = ({onClose, logs, project}) => {
  const { t } = useTranslation()

  const getDownloadTitle = option => {
    if(option === 'csv')
      return t('common.download_csv')
    if(option === 'candidates_metadata')
      return t('map_project.candidates_metadata')
    if(option === 'full_export')
      return t('map_project.full_project_export')

    return option ? startCase(option) : startCase('downloaded')
  }

  const getIconAndColor = log => {
    const action = log?.action?.toLowerCase()
    if(action === 'created')
      return [<i key="created" className="fa-brands fa-octopus-deploy" style={{color: PRIMARY_COLORS.main, fontSize: '1.25rem', width: '1em', height: '1em'}}></i>, 'primary']
    if(action === 'updated')
      return [<HistoryIcon key='update' color='warning' />, 'warning']
    if(action === 'auto saved')
      return [<HistoryIcon key='auto-save' color='primary' />, 'primary']
    if(action === 'saved_to_collection')
      return [<RepoIcon key='collection' selected noTooltip />, 'primary']
    if(action === 'opened')
      return [<OpenIcon key='open' />, 'secondary']
    if(action === 'downloaded')
      return [<DownloadIcon key='download' />, 'secondary']
    if(action === 'auto_match_stopped_by_user')
      return [<StopIcon key='stop' color='error' />, 'error']
    if(['auto_match_started', 'auto_match_finished', 'auto_matched'].includes(action))
      return [<AutoMatchIcon key='auto_match' color={['auto_match_finished', 'auto_matched'].includes(action) ? 'primary' : 'warning'} />, ['auto_match_finished', 'auto_matched'].includes(action) ? 'primary' : 'warning']
    return [<HistoryIcon key='log' color='warning' />, 'warning']
  }


  const formatSubAction = subAction => {
    let result = '';
    if(subAction.startsWith('with_')) {
      result = 'with '
      subAction = subAction.replace('with_', '')
    }
    if(subAction.includes('ai_analysis'))
      result += 'AI Analysis'
    else
      result += startCase(subAction)
    return result
  }

  const getTitle = log => {
    if(log.action === 'saved_to_collection' && log.extras?.collection_url && log.extras?.id)
      return <span>
               {t('map_project.saved_to_collection')}
               <a className='no-anchor-styles' style={{color: PRIMARY_COLORS.main, marginLeft: '4px'}} target='_blank' href={toV3URL(log.extras.collection_url)} rel="noreferrer">
                 {log.extras.id}
               </a>
              </span>
    if(log.action === 'downloaded')
      return getDownloadTitle(log.extras?.option)
    if(['auto_match_started', 'auto_match_finished', 'auto_matched'].includes(log.action)) {
      const rawSubActions = (log.extras?.sub_actions || []).filter(subAction => log.extras?.selected_rows_count ? subAction !== 'selected_rows' : true)
      const subActions = map(rawSubActions, formatSubAction)
      if(log.extras?.selected_rows_count)
        subActions.push(`${log.extras.selected_rows_count.toLocaleString()} Selected Rows`)
      return <span>
               {startCase(log.action)}
               {
                 subActions.length ?
                <span style={{marginLeft: '4px'}}>
                  {`(${subActions.join(', ')})`}
                </span> :
                null
               }
             </span>
    }
    if(log?.action?.toLowerCase() === 'created') {
      return <Trans
               i18nKey="map_project.created_by_log"
               components={[
                 <strong key={0} />,
                 <strong key={1} />,
               ]}
               values={{
                 created_by: log.user || project.created_by || '',
                 owner: project.owner ? `${project.owner_type}:${project.owner}` : '',
               }}
             />
    }

    if(log?.action?.toLowerCase() === 'auto saved')
      return log.description || t('map_project.auto_saved_changes')
    if(log.description)
      return log.description
    return startCase(log.action)
  }

  return (
    <div className='col-xs-12 padding-0'>
      <div className='col-xs-12' style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px'}}>
        <Typography component='span' sx={{fontSize: '22px', color: 'surface.dark', fontWeight: 600, display: 'flex', alignItems: 'center'}}>
          {t('map_project.project_logs')}
        </Typography>
        <CloseIconButton color='secondary' onClick={onClose} />
      </div>
      <div className='col-xs-12 padding-0' style={{maxHeight: 'calc(100vh - 190px)', overflow: 'auto'}}>
        <Timeline
          sx={{
            padding: '4px 20px',
            marginBottom: 0,
            [`& .${timelineItemClasses.root}:before`]: {
              flex: '0 !important',
              padding: '0 !important',
            },
            [`& .${timelineItemClasses.missingOppositeContent}::before`]: {
              flex: '0 !important',
              padding: '0 !important',
            },
          }}
        >
          {
            map(orderBy(logs, log => moment(log.created_at), ['asc']), (log, index) => {
              const [icon, color] = getIconAndColor(log)
              return (
                <TimelineItem key={index}>
                  <TimelineSeparator>
                    <Tooltip title={startCase(log.action)}>
                      <TimelineDot color={color} variant="outlined" sx={{margin: 0}}>
                        {icon}
                      </TimelineDot>
                    </Tooltip>
                    {
                      index !== (logs.length - 1) &&
                        <TimelineConnector />
                    }
                  </TimelineSeparator>
                  <TimelineContent sx={{padding: '0 16px', margin: '-2px 0 0 0'}}>
                    <Typography component="span" sx={{fontSize: '14px'}}>
                      {getTitle(log)}
                    </Typography>
                    <Typography sx={{fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)'}}>
                      {log.user} at {moment(log.created_at).format('ll LTS')}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              )

            })
          }
        </Timeline>
      </div>
    </div>
  )
}

export default ProjectLogs
