import React from 'react';
import { useTranslation } from 'react-i18next'
import { Menu, ListItem, ListItemButton, ListItemText, ListItemIcon} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit';

const ConceptManagementList = ({ anchorEl, open, onClose, id, onClick }) => {
  const { t } = useTranslation()
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      slotProps={{
        list: {'aria-labelledby': id, role: 'listbox'},
      }}
      sx={{'.MuiMenu-list': {padding: 0, minWidth: '200px'}}}
    >
      <ListItem disablePadding>
        <ListItemButton id='editConcept' onClick={() => onClick('editConcept')} sx={{padding: '8px 12px'}}>
          <ListItemIcon sx={{minWidth: 'auto', marginRight: '12px'}}>
            <EditIcon />
          </ListItemIcon>
          <ListItemText primary={t('concept.edit_concept')} />
        </ListItemButton>
      </ListItem>
    </Menu>
  )
}

export default ConceptManagementList;
