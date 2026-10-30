import React from 'react';
import { useTranslation } from 'react-i18next'
import { Menu, ListItemButton, ListItemText, ListItemIcon, Divider} from '@mui/material'
import ImportIcon from '@mui/icons-material/Publish';
import { getCurrentUser, hasTermBrowser, toV3URL } from '../../common/utils';
import { createItems } from '../../common/navigation';
import OrgIcon from '../orgs/OrgIcon'
import RepoIcon from '../repos/RepoIcon'

const ITEM_SX = {padding: '8px 12px', '&:hover': {color: 'inherit'}, '&:focus': {outline: 'none', textDecoration: 'none', color: 'inherit'}}

const CREATE_ITEM_IDS = {org: 'addOrg', repo: 'addRepo', 'map-project': 'addMapProject', import: 'bulkImport'}
const CREATE_ITEM_LABELS = {org: 'org.org', repo: 'repo.repo', 'map-project': 'map_project.mapping_project', import: 'import.bulk_import'}
const CREATE_ITEM_ICONS = {
  org: <OrgIcon noTooltip noLink strict />,
  repo: <RepoIcon noTooltip />,
  'map-project': <i style={{fontSize: '1.25rem'}} className="fa-solid fa-diagram-project"></i>,
  import: <ImportIcon />
}

const AddMenuList = ({ anchorEl, open, onClose }) => {
  const { t } = useTranslation()
  const user = getCurrentUser()
  return (
    <Menu
      id='user-add-menu-list'
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      sx={{'.MuiPaper-root': {backgroundColor: 'surface.n94', minWidth: '200px'}}}
    >
      {
        createItems(user, true).filter(item => hasTermBrowser() || item.app !== 'v3').flatMap(item => [
          item.divider && <Divider key={`${item.key}-divider`} />,
          <ListItemButton key={item.key} id={CREATE_ITEM_IDS[item.key]} href={item.app === 'v3' ? toV3URL(item.path) : item.path} sx={ITEM_SX} onClick={onClose}>
            <ListItemIcon sx={{minWidth: 'auto', marginRight: '12px'}}>
              {CREATE_ITEM_ICONS[item.key]}
            </ListItemIcon>
            <ListItemText primary={t(CREATE_ITEM_LABELS[item.key])} />
          </ListItemButton>
        ])
      }
    </Menu>
  )
}
export default AddMenuList;
