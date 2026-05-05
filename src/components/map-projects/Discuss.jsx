import React from 'react'
import { useTranslation } from 'react-i18next';
import moment from 'moment'

import Timeline  from '@mui/lab/Timeline';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button'
import CommentIcon from '@mui/icons-material/Message';
import MapIcon from '@mui/icons-material/Link';
import UnmapIcon from '@mui/icons-material/LinkOff';
import RejectIcon from '@mui/icons-material/Clear';
import ExcludeIcon from '@mui/icons-material/Block';
import AutoMatchIcon from '@mui/icons-material/MotionPhotosAutoOutlined';
import AssistantIcon from '@mui/icons-material/Assistant';
import ReviewedIcon from '@mui/icons-material/FactCheckOutlined';
import AlgoIcon from '@mui/icons-material/JoinRight';
import RerankIcon from '@mui/icons-material/LowPriority';

import map from 'lodash/map'
import startCase from 'lodash/startCase'
import orderBy from 'lodash/orderBy'

import Comment from './Comment'


const Discuss = ({ logs, onAdd }) => {
  const { t } = useTranslation();
  const [comment, setComment] = React.useState('')
  const getTitle = log => {
    if(['mapped', 'unmapped', 'auto-matched', 'rejected'].includes(log.action)) {
      if(log.action === 'rejected' && log.description)
        return log.description
      let description = startCase(log.action)
      if(log.extras?.name)
        description += `: ${log.extras?.name}`
      if(log?.extras?.map_type || log?.extras?.mapType) {
        if(description?.includes(':'))
          description += ':'
        description += ` (${log.extras.map_type || log.extras.mapType})`
      }
      return description
    }
    if (log.action === 'exclude')
      return t('map_project.excluded')
    if(['AIRecommendation'].includes(log.action))
      return `${log.action}: ${log.description}`
    if(['commented'].includes(log.action)) {
      return <b>{log.description}</b>
    }
    if(log.action === 'algo_finished')
      return <>{t('map_project.finished_running')} <b>{log.extras.algo}</b></>
    if(log.action === 'rerank_finished') {
      if(log.description)
        return log.description
      return <>{t('map_project.finished_reranking')}</>
    }
    return log.description || startCase(log.action)
  }

  const getIcon = (log, color) => {
    if(log.action === 'AIRecommendation')
      return <AssistantIcon fontSize='small' color={color} />
    if(log.action === 'commented')
      return <CommentIcon fontSize='small' color={color} />
    if(log.action === 'approved' || log.action === 'reviewed')
      return <ReviewedIcon fontSize='small' color={color} />
    if(['mapped'].includes(log.action))
      return <MapIcon fontSize='small' color={color} />
    if(['auto-matched'].includes(log.action))
      return <AutoMatchIcon fontSize='small' color={color} />
    if(log.action === 'unmapped')
      return <UnmapIcon fontSize='small' color={color} />
    if(log.action === 'rejected')
      return <RejectIcon fontSize='small' color={color} />
    if(log.action === 'exclude')
      return <ExcludeIcon fontSize='small' color={color} />
    if(log.action === 'algo_finished')
      return <AlgoIcon fontSize='small' color={color} />
    if(log.action === 'rerank_finished')
      return <RerankIcon fontSize='small' color={color} />
    return log.user.slice(0, 2).toUpperCase()
  }

  const getDotColor = log => {
    if(['unmapped', 'rejected', 'exclude'].includes(log.action))
      return 'error'
    if(['proposed'].includes(log.action))
      return 'warning'
    if(['mapped', 'auto-matched', 'AIRecommendation', 'approved', 'reviewed', 'algo_finished', 'rerank_finished'].includes(log.action))
      return log.extras?.error ? 'error' : 'primary'
    return undefined
  }

  const onClick = () => {
    onAdd(comment)
    setComment('')
  }


  return (
    <>
      <div className='col-xs-12 padding-0' style={{maxHeight: 'calc(100vh - 576px)', overflow: 'auto'}}>
      <Timeline
        sx={{
          padding: '4px 16px',
          marginBottom: 0,
          [`& .${timelineItemClasses.root}:before`]: {
            flex: 0,
            padding: 0,
          },
        }}
      >
        {
          map(orderBy(logs, log => moment(log.created_at), ['asc']), (log, index) => {
            const dotColor = getDotColor(log)
            const isComment = log.action === 'commented'
            const sx = isComment ? {display: 'inline-block'} : {}
            return (
              <TimelineItem key={log.created_at.toString()} sx={sx}>
                <TimelineSeparator sx={isComment ? {alignItems: 'flex-start'} : {}}>
                  {
                    isComment ?
                      <Comment
                        header={
                          <>
                            <b>{log.user}</b> <span style={{color: '#59636e'}}>{moment(log.created_at).fromNow()}</span>
                          </>
                        }
                        body={log.description}
                      /> :
                    <Tooltip title={startCase(log.action)}>
                    <TimelineDot color={dotColor} variant="outlined" sx={{margin: 0}}>
                        {getIcon(log, dotColor)}
                      </TimelineDot>
                    </Tooltip>
                  }
                  {
                    index !== (logs.length - 1) &&
                      <TimelineConnector sx={isComment ? {height: '30px', marginLeft: '15px'} : {}} />
                  }
                </TimelineSeparator>
                {
                !isComment &&
                    <TimelineContent sx={{padding: '0 16px', margin: '-2px 0 0 0'}}>
                      <Typography component="span" sx={{fontSize: '14px'}}>
                        {getTitle(log)}
                      </Typography>
                      {
                        log.action === 'AIRecommendation' && log?.extras?.model?.id &&
                          <Typography sx={{fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)'}}>
                            {log.extras.model.name}
                          </Typography>
                      }
                      {
                        log.action === 'AIRecommendation' && log?.extras?.prompt_template?.key &&
                          <Typography sx={{fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)'}}>
                            {t('map_project.ai_prompt_template')}: {log.extras.prompt_template.key} ({t('common.version')}: {log.extras.prompt_template.version || '-'})
                          </Typography>
                      }
                      {
                        log?.extras?.algorithm &&
                          <Typography sx={{fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)'}}>
                            {t('map_project.algorithm')}: {log.extras.algorithm}
                          </Typography>
                      }
                      <Typography sx={{fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)'}}>
                        {log.user} {t('common.at')} {moment(log.created_at).format('ll LTS')}
                      </Typography>
                    </TimelineContent>
                }
              </TimelineItem>
            )
          })
        }
      </Timeline>
      </div>
      <div className='col-xs-12' style={{padding: '4px 16px'}}>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          value={comment}
          label={t('map_project.comment')}
          onChange={event => setComment(event.target.value || '')}
          sx={{
            '.MuiInputBase-root': {
              fontSize: '14px',
              padding: '4px 8px',
              '.MuiInputBase-inputMultiline': {
                height: '20px'
              }
            }
          }}
        />
    <div className='col-xs-12 padding-0' style={{textAlign: 'right'}}>
          <Button onClick={onClick} sx={{textTransform: 'none', marginTop: '8px'}} variant='outlined' color='primary' size='small'>
            {t('map_project.comment')}
          </Button>
        </div>
      </div>
    </>
  )
}

export default Discuss;
