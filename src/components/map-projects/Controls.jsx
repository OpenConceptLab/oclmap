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
import DownloadIcon from '@mui/icons-material/Download';
import TimelineIcon from '@mui/icons-material/Timeline';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CopyIcon from '@mui/icons-material/CopyAll';
import JSONIcon from '@mui/icons-material/DataObject';
import { copyToClipboard } from '../../common/utils'
import RepoIcon from '../repos/RepoIcon'

const IkonButton = ({title, icon, onClick, color, disabled, id}) => {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          id={id}
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

const Controls = ({project, onDownload, onSave, onDelete, owner, file, isSaving, onImport, importResponse, onDownloadImportReport, onProjectLogsClick, isProjectsLogOpen, configure, setConfigure, isCoreUser, loadingMatches, onCopyClick}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const downloadOpen = Boolean(anchorEl);
  const lastSavedText = project?.updated_at ? moment(project.updated_at).fromNow() : false
  const isRunningImport = ['STARTED', 'RECEIVED', 'PENDING'].includes(importResponse?.state)

  return (
    <span style={{textAlign: 'right'}}>
      <div>
        <IkonButton
          color={configure ? 'primary' : 'secondary'}
          onClick={() => setConfigure(!configure)}
          title={t('map_project.configure_mapping_project_tooltip')}
          icon={<SettingsIcon />}
          disabled={loadingMatches}
        />
        <IkonButton
          color={isProjectsLogOpen ? 'primary' : 'secondary'}
          onClick={onProjectLogsClick}
          title={t('map_project.project_logs_tooltip')}
          icon={<TimelineIcon />}
        />
        <IkonButton
          color='secondary'
          onClick={onSave}
          title={t('map_project.save_this_project')}
          disabled={!owner || !file?.name || isSaving || loadingMatches}
          icon={<SaveIcon />}
        />
        <IkonButton
          id='download-button'
          color={downloadOpen ? 'primary' : 'secondary'}
          onClick={event => setAnchorEl(event.currentTarget)}
          title={t('map_project.download_this_project_as_csv')}
          icon={<DownloadIcon />}
          disabled={loadingMatches}
        />
        {
          project?.id &&
            <IkonButton
              id='copy-button'
              color='secondary'
              onClick={onCopyClick}
              title={t('map_project.copy_project')}
              icon={<CopyIcon />}
            />
        }
        {
          project?.id &&
            <IkonButton
              color='secondary'
              disabled={isSaving || loadingMatches}
              onClick={onDelete}
              title={t('map_project.delete_this_project')}
              icon={<DeleteIcon />}
            />
        }
      </div>
      {
        (lastSavedText || isSaving) &&
          <div style={{fontSize: '11px', color: 'rgba(0, 0, 0, 0.6)', textAlign: 'right', marginTop: '-4px'}}>
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
        anchorEl={anchorEl}
        open={downloadOpen}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          list: {
            'aria-labelledby': 'download-button',
            role: 'listbox',
          },
        }}
      >
        <MenuItem onClick={() => {setAnchorEl(null); onDownload('csv');}}>
          <ListItemIcon>
            <i className="fa-solid fa-file-csv" style={{fontSize: '1.25rem'}}></i>
          </ListItemIcon>
          <ListItemText>{t('common.download_csv')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {setAnchorEl(null); onDownload('candidates_metadata');}} disabled={!isCoreUser}>
          <ListItemIcon>
            <JSONIcon sx={{fontSize: '1.25rem'}} />
          </ListItemIcon>
          <ListItemText>{t('map_project.candidates_metadata')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {setAnchorEl(null); onImport();}} disabled={!onImport || isRunningImport}>
          <ListItemIcon>
            <RepoIcon noTooltip />
          </ListItemIcon>
          <ListItemText>{t('map_project.save_to_collection')}</ListItemText>
          {isRunningImport ? <CircularProgress sx={{marginLeft: '16px'}} size={20} /> : null}
        </MenuItem>
      </Menu>
    </span>

  )
}

export default Controls
