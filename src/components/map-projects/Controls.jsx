import React from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import CircularProgress from '@mui/material/CircularProgress'
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import AutoMatchIcon from '@mui/icons-material/MotionPhotosAutoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import TimelineIcon from '@mui/icons-material/Timeline';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CopyIcon from '@mui/icons-material/CopyAll';
import JSONIcon from '@mui/icons-material/DataObject';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { copyToClipboard } from '../../common/utils'
import RepoIcon from '../repos/RepoIcon'
import { getToolbarLayout, HEADER_RESERVED_WIDTH } from './controlsLayout'

const IkonButton = ({title, icon, onClick, color, disabled, id}) => {
  return (
    <Tooltip title={title} placement='bottom'>
      <span>
        <IconButton
          id={id}
          aria-label={title}
          color={color}
          size='small'
          sx={{textTransform: 'none', margin: '2px 5px'}}
          onClick={onClick}
          disabled={disabled}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  )
}

const Controls = ({project, onDownload, onSave, onDelete, owner, file, isSaving, onImport, importResponse, onDownloadImportReport, onProjectLogsClick, isProjectsLogOpen, configure, setConfigure, isCoreUser, loadingMatches, onCopyClick, autoMatch}) => {
  const { t } = useTranslation();
  const toolbarRef = React.useRef(null)
  const overflowButtonRef = React.useRef(null)
  const [downloadAnchorEl, setDownloadAnchorEl] = React.useState(null);
  const [overflowAnchorEl, setOverflowAnchorEl] = React.useState(null);
  const [toolbarWidth, setToolbarWidth] = React.useState(Number.POSITIVE_INFINITY)
  const downloadOpen = Boolean(downloadAnchorEl);
  const overflowOpen = Boolean(overflowAnchorEl);
  const lastSavedText = project?.updated_at ? moment(project.updated_at).fromNow() : false
  const isRunningImport = ['STARTED', 'RECEIVED', 'PENDING'].includes(importResponse?.state)
  const hasPersistentOverflowActions = Boolean(project?.id)

  React.useEffect(() => {
    const node = toolbarRef.current?.parentElement
    if (!node) return undefined

    const updateToolbarWidth = () => {
      const nextWidth = node.getBoundingClientRect?.().width
      setToolbarWidth(nextWidth ? nextWidth - HEADER_RESERVED_WIDTH : Number.POSITIVE_INFINITY)
    }

    updateToolbarWidth()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateToolbarWidth)
      observer.observe(node)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateToolbarWidth)
    return () => window.removeEventListener('resize', updateToolbarWidth)
  }, [])

  const actionsByKey = {
    settings: {
      key: 'settings',
      color: configure ? 'primary' : 'secondary',
      disabled: loadingMatches,
      icon: <SettingsIcon />,
      onClick: () => setConfigure(!configure),
      title: t('map_project.configure_mapping_project_tooltip')
    },
    timeline: {
      key: 'timeline',
      color: isProjectsLogOpen ? 'primary' : 'secondary',
      icon: <TimelineIcon />,
      onClick: onProjectLogsClick,
      title: t('map_project.project_logs_tooltip')
    },
    download: {
      key: 'download',
      color: downloadOpen ? 'primary' : 'secondary',
      disabled: loadingMatches,
      icon: <DownloadIcon />,
      onClick: event => setDownloadAnchorEl(event.currentTarget),
      title: t('map_project.download_this_project_as_csv')
    },
    save: {
      key: 'save',
      color: 'secondary',
      disabled: !owner || !file?.name || isSaving || loadingMatches,
      icon: <SaveIcon />,
      onClick: onSave,
      title: t('map_project.save_this_project')
    }
  }

  const hasActions = Boolean(file?.name)
  const { autoMatch: autoMatchMode, saveInMenu, overflowActionKeys, visibleActionKeys } = hasActions ?
    getToolbarLayout({
      toolbarWidth,
      hasOverflowItems: hasPersistentOverflowActions,
      hasAutoMatch: Boolean(autoMatch)
    }) :
    {autoMatch: 'full', saveInMenu: false, overflowActionKeys: [], visibleActionKeys: []}

  const visibleSecondaryActions = visibleActionKeys.map(key => actionsByKey[key])
  const overflowSecondaryActions = overflowActionKeys.map(key => actionsByKey[key])
  const autoMatchInMenu = Boolean(autoMatch) && autoMatchMode === 'menu'
  const hasOverflowActions = hasActions && (hasPersistentOverflowActions || overflowSecondaryActions.length > 0 || saveInMenu || autoMatchInMenu)
  const overflowMenuActions = [
    ...(autoMatchInMenu ? [{key: 'autoMatch', icon: <AutoMatchIcon />, title: autoMatch.label, disabled: autoMatch.disabled || autoMatch.loading, onClick: autoMatch.onClick}] : []),
    ...overflowSecondaryActions,
    ...(saveInMenu ? [actionsByKey.save] : [])
  ]

  const closeDownloadMenu = () => setDownloadAnchorEl(null)
  const closeOverflowMenu = () => setOverflowAnchorEl(null)

  const onOverflowActionClick = action => event => {
    closeOverflowMenu()

    if (action.key === 'download') {
      setDownloadAnchorEl(overflowButtonRef.current || event.currentTarget)
      return
    }

    action.onClick(event)
  }

  return (
    <span ref={toolbarRef} style={{display: 'flex', flex: '0 0 auto', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0}}>
      <div style={{display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0}}>
        {
          autoMatch && !autoMatchInMenu && (autoMatchMode === 'compact' ?
            <Tooltip title={autoMatch.label} placement='bottom'>
              <span>
                <IconButton
                  aria-label={autoMatch.label}
                  color='primary'
                  size='small'
                  sx={{margin: '2px 5px'}}
                  onClick={autoMatch.onClick}
                  disabled={autoMatch.disabled || autoMatch.loading}
                >
                  {autoMatch.loading ? <CircularProgress size={20} /> : <AutoMatchIcon />}
                </IconButton>
              </span>
            </Tooltip> :
            <Button
              variant='contained'
              size='small'
              sx={{textTransform: 'none', margin: '5px', whiteSpace: 'nowrap', flexShrink: 0}}
              endIcon={<DoubleArrowIcon />}
              startIcon={<AutoMatchIcon />}
              disabled={autoMatch.disabled}
              onClick={autoMatch.onClick}
              loading={autoMatch.loading}
              loadingPosition='start'
            >
              {autoMatch.label}
            </Button>
          )
        }
        {
          autoMatch && !autoMatchInMenu && hasActions &&
            <Divider flexItem orientation='vertical' sx={{mx: 0.5, my: 0.75}} />
        }
        {
          visibleSecondaryActions.map(action => (
            <IkonButton
              key={action.key}
              color={action.color}
              onClick={action.onClick}
              title={action.title}
              icon={action.icon}
              disabled={action.disabled}
              id={action.key === 'download' ? 'download-button' : undefined}
            />
          ))
        }
        {
          visibleSecondaryActions.length > 0 &&
            <Divider flexItem orientation='vertical' sx={{mx: 0.5, my: 0.75}} />
        }
        {
          hasActions && !saveInMenu &&
            <IkonButton
              color={actionsByKey.save.color}
              onClick={actionsByKey.save.onClick}
              title={actionsByKey.save.title}
              disabled={actionsByKey.save.disabled}
              icon={actionsByKey.save.icon}
            />
        }
        {
          hasOverflowActions &&
            <>
              {!saveInMenu && <Divider flexItem orientation='vertical' sx={{mx: 0.5, my: 0.75}} />}
              <Tooltip title={t('common.more_actions')} placement='bottom'>
                <span>
                  <IconButton
                    id='map-project-controls-overflow-button'
                    ref={overflowButtonRef}
                    color={overflowOpen ? 'primary' : 'secondary'}
                    size='small'
                    aria-label={t('common.more_actions')}
                    aria-haspopup='menu'
                    aria-controls={overflowOpen ? 'map-project-controls-overflow-menu' : undefined}
                    aria-expanded={overflowOpen ? 'true' : undefined}
                    sx={{textTransform: 'none', margin: '2px 5px'}}
                    onClick={event => setOverflowAnchorEl(event.currentTarget)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </>
        }
      </div>
      {
        (lastSavedText || isSaving) &&
          <div style={{fontSize: '11px', color: 'rgba(0, 0, 0, 0.6)', textAlign: 'right', marginTop: '-4px', whiteSpace: 'nowrap'}}>
            {
              isSaving ? t('map_project.saving') :
                t('map_project.last_saved', {time: lastSavedText})
            }
          </div>
      }
      {
        (importResponse?.state) &&
          <div style={{fontSize: '11px', color: 'rgba(0, 0, 0, 0.6)', textAlign: 'right', marginTop: '-2px'}}>
            {`Import (${importResponse.state.toLowerCase()})`}:
            <Tooltip title={importResponse.id}>
              <span style={{marginLeft: '4px'}} onClick={() => copyToClipboard(importResponse.id)}>{`${importResponse.id.slice(0,8)}..${importResponse.id.slice(importResponse.id.length - 4, importResponse.id.length)}`}</span>
            </Tooltip>
            {
              importResponse?.state === 'SUCCESS' ?
                <Tooltip title={t('map_project.click_to_download_import_report')}>
                  <Button size='small' variant='text' sx={{padding: '0 4px', textTransform: 'none', fontSize: '11px', minWidth: 'auto', '.MuiButton-endIcon': {marginLeft: '2px', marginRight: 0}}} onClick={() => onDownloadImportReport(importResponse.id)} endIcon={<DownloadIcon sx={{fontSize: '12px !important'}} />}>
                    {t('common.report')}
                  </Button>
                </Tooltip> :
              <>
                <br/>
                {importResponse?.message}
              </>
            }
          </div>
      }

      <Menu
        id="download-menu"
        anchorEl={downloadAnchorEl}
        open={downloadOpen}
        onClose={closeDownloadMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: {
            'aria-labelledby': downloadAnchorEl?.id,
            role: 'listbox',
          },
        }}
      >
        <MenuItem onClick={() => {closeDownloadMenu(); onDownload('csv');}}>
          <ListItemIcon>
            <i className="fa-solid fa-file-csv" style={{fontSize: '1.25rem'}}></i>
          </ListItemIcon>
          <ListItemText>{t('common.download_csv')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {closeDownloadMenu(); onDownload('candidates_metadata');}} disabled={!isCoreUser}>
          <ListItemIcon>
            <JSONIcon sx={{fontSize: '1.25rem'}} />
          </ListItemIcon>
          <ListItemText>{t('map_project.candidates_metadata')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {closeDownloadMenu(); onDownload('full_export');}} disabled={!isCoreUser}>
          <ListItemIcon>
            <JSONIcon sx={{fontSize: '1.25rem'}} />
          </ListItemIcon>
          <ListItemText>{t('map_project.full_project_export')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {closeDownloadMenu(); onImport();}} disabled={!onImport || isRunningImport}>
          <ListItemIcon>
            <RepoIcon noTooltip />
          </ListItemIcon>
          <ListItemText>{t('map_project.save_to_collection')}</ListItemText>
          {isRunningImport ? <CircularProgress sx={{marginLeft: '16px'}} size={20} /> : null}
        </MenuItem>
      </Menu>
      <Menu
        id='map-project-controls-overflow-menu'
        anchorEl={overflowAnchorEl}
        open={overflowOpen}
        onClose={closeOverflowMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {
          overflowMenuActions.map(action => (
            <MenuItem key={action.key} onClick={onOverflowActionClick(action)} disabled={action.disabled}>
              <ListItemIcon>{action.icon}</ListItemIcon>
              <ListItemText>{action.title}</ListItemText>
            </MenuItem>
          ))
        }
        {
          overflowMenuActions.length > 0 && project?.id &&
            <Divider />
        }
        {
          project?.id &&
            <MenuItem onClick={event => { onCopyClick(event); closeOverflowMenu(); }}>
              <ListItemIcon><CopyIcon fontSize='small' /></ListItemIcon>
              <ListItemText>{t('map_project.create_similar')}</ListItemText>
            </MenuItem>
        }
        {
          project?.id &&
            <Divider />
        }
        {
          project?.id &&
            <MenuItem onClick={() => { closeOverflowMenu(); onDelete(); }} disabled={isSaving || loadingMatches} sx={{color: 'error.main'}}>
              <ListItemIcon sx={{color: 'error.main'}}><DeleteIcon fontSize='small' /></ListItemIcon>
              <ListItemText>{t('common.delete')}</ListItemText>
            </MenuItem>
        }
      </Menu>
    </span>

  )
}

export default Controls
