import React from 'react';
import { useTranslation } from 'react-i18next';
import has from 'lodash/has';
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import DownIcon from '@mui/icons-material/ArrowDropDown';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AssistantIcon from '@mui/icons-material/Assistant';
import CloseIconButton from '../common/CloseIconButton';
import { toOwnerURI, toV3URL, currentUserHasAccess } from '../../common/utils';
import Breadcrumbs from '../common/Breadcrumbs'
import { BLACK } from '../../common/colors'
import ConceptManagementList from './ConceptManagementList'
import MapButton from '../map-projects/MapButton'

const ConceptHeader = ({concept, repo, onClose, repoURL, onEdit, nested, loading, onMap, isSelectedForMap, aiRecommended, aiAlternate, crossRowCode, hideClose, hideDragHandle}) => {
  const { t } = useTranslation()
  const [menu, setMenu] = React.useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(false)
  const onMenuOpen = event => {
    setMenuAnchorEl(event.currentTarget)
    setMenu(true)
  }
  const onMenuClose = () => {
    setMenuAnchorEl(false)
    setMenu(false)
  }

  const onManageOptionClick = option => {
    onMenuClose()
    if(option === 'editConcept') {
      onEdit()
    }
  }

  // toV3URL already prepends the SPA hash (`/#`); pass the bare relative URL
  // so we don't get a double-hash (`/#/#/...`) target.
  const termBrowserUrl = concept?.url ? toV3URL(concept.url) : null
  const headerWrapperStyle = hideDragHandle
    ? {}
    : {cursor: 'move'}
  const headerWrapperId = hideDragHandle ? undefined : 'draggable-dialog-title'

  return (
    <div className='col-xs-12 padding-0' style={headerWrapperStyle} id={headerWrapperId}>
      <div className='col-xs-12 padding-0' style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span style={{width: hideClose ? '100%' : 'calc(100% - 80px)'}}>
          {
            !concept?.source ?
              <Skeleton variant='text' sx={{fontSize: '22px', width: '50px'}} />:
            <Breadcrumbs
              ownerURL={repoURL ? toOwnerURI(repoURL) : false}
              owner={concept.owner}
              ownerType={concept.owner_type}
              repo={concept.source}
              repoVersion={concept.latest_source_version}
              repoType={concept.source?.type}
              version={concept.version}
              repoURL={repoURL}
              concept={concept}
              nested={nested}
            />
          }
        </span>
        <span style={{display: 'flex', alignItems: 'center'}}>
          {
            termBrowserUrl && (
              <Tooltip title={t('concept.open_in_term_browser')}>
                <IconButton
                  size='small'
                  color='secondary'
                  href={termBrowserUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  sx={{marginRight: hideClose ? 0 : '4px'}}
                  aria-label={t('concept.open_in_term_browser')}
                >
                  <OpenInNewIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            )
          }
          {!hideClose && <CloseIconButton color='secondary' onClick={onClose} />}
        </span>
      </div>
    <div className='col-xs-12' style={{padding: '0px'}}>
    {
      !concept?.id ?
        <Skeleton variant='text' sx={{fontSize: '22px', width: '150px'}} />:
      <span style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
      <Typography sx={{fontSize: '22px', color: BLACK}} className='searchable'>
      {concept.display_name}
      </Typography>
        {
          onMap &&
            <MapButton
              simple
              selected={concept?.search_meta?.map_type}
              onClick={(event, applied, mapType) => onMap(event, concept, !applied, mapType, true)}
              isMapped={isSelectedForMap(concept)}
              sx={{marginLeft: '8px'}}
            />
        }
      </span>
    }
    </div>
      {
        (aiRecommended || aiAlternate || crossRowCode) && (
          // Chip row sits BELOW the display name (and above the Properties
          // panel) so the breadcrumb + title read as one unit. `clear`/`width`
          // are required because the title row above is a Bootstrap `col-xs-12`
          // (float: left, full width); without clearing, this non-floated row
          // gets squeezed into the zero-width gap beside that float and collapses.
          <Stack direction='row' spacing={0.75} sx={{clear: 'both', width: '100%', marginTop: '8px', flexWrap: 'wrap'}}>
            {
              aiRecommended &&
                <Chip
                  size='small'
                  color='primary'
                  variant='outlined'
                  icon={<AssistantIcon fontSize='small' />}
                  label={t('map_project.ai_recommended')}
                  sx={{padding: '4px'}}
                />
            }
            {
              !aiRecommended && aiAlternate &&
                <Chip
                  size='small'
                  color='warning'
                  variant='outlined'
                  icon={<AssistantIcon fontSize='small' />}
                  label={t('map_project.ai_alternate')}
                  sx={{padding: '4px'}}
                />
            }
            {
              crossRowCode &&
                <Chip
                  size='small'
                  color='secondary'
                  variant='outlined'
                  label={t('concept.also_candidate_for', {code: crossRowCode})}
                  sx={{padding: '4px'}}
                />
            }
          </Stack>
        )
      }
    {
      false && currentUserHasAccess() && repo?.version === 'HEAD' && has(repo, 'source_type') && !loading &&
      <div className='col-xs-12 padding-0' style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span style={{display: 'flex', alignItems: 'center'}} />
            <span>
              <Button endIcon={<DownIcon fontSize='inherit' />} variant='text' sx={{textTransform: 'none', color: 'surface.contrastText'}} onClick={onMenuOpen} id='concept-actions'>
                {t('common.actions')}
              </Button>
              <ConceptManagementList anchorEl={menuAnchorEl} open={menu} onClose={onMenuClose} id='concept-actions' onClick={onManageOptionClick} />
            </span>
      </div>
        }
    </div>
  )
}

export default ConceptHeader;
