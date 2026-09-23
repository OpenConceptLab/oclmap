import React from 'react'
import { useHistory } from 'react-router-dom'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import Dialog from '../common/Dialog'
import DialogTitle from '../common/DialogTitle'
import APIService from '../../services/APIService'
import GAService from '../../services/GAService'
import { OperationsContext } from '../app/LayoutContext';
import { useTranslation, Trans } from 'react-i18next';


const MapProjectDeleteConfirmDialog = ({ project, open, onClose }) => {
  const { t } = useTranslation();
  const { setAlert } = React.useContext(OperationsContext);
  const history = useHistory()
  const [value, setValue] = React.useState('')

  const onDelete = () => {
    GAService.recordActionEvent('MapProject', 'delete_map_project')
    APIService.new().overrideURL(project.url).delete().then(response => {
      if(response.status === 204) {
        onClose(true)
        history.push('/')
        setAlert({severity: 'success', message: t('map_project.successfully_deleted'), duration: 2000})
      }
    })
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span>{t('map_project.delete_map_project')}</span>
        <IconButton color='secondary' onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{padding: 0, paddingTop: '20px !important'}}>
        {t('map_project.delete_map_project_warning')}
        <br/>
        <br/>
        <Trans
          i18nKey='map_project.delete_map_project_confirm'
          components={[
            <b key={0}>{project.name}</b>
          ]}
          values={{name: project.name}}
        />
        <br/>
        <br/>
        <Trans
          i18nKey='map_project.delete_map_project_type_to_confirm'
          components={[
            <b key={0}>{project.name}</b>
          ]}
          values={{name: project.name}}
        />
        <br/>
        <br/>

        <TextField
          fullWidth
          id='project-delete'
          value={value}
          onChange={event => setValue(event.target.value || '')}
        />
      </DialogContent>
      <DialogActions>
        <Button sx={{textTransform: 'none'}} variant='contained' color='error' disabled={value !== project.name} onClick={onDelete}>
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default MapProjectDeleteConfirmDialog
