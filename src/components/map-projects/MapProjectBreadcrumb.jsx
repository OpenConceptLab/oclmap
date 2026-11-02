import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import OwnerButton from '../common/OwnerButton';
import DotSeparator from '../common/DotSeparator';
import { hasTermBrowser, toV3URL } from '../../common/utils';
import { projectCrumbs } from '../../common/breadcrumb';

const LABEL_SX = {
  maxWidth: '125px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: '14px',
  whiteSpace: 'nowrap',
}

const MapProjectBreadcrumb = ({ ownerType, owner }) => {
  const { t } = useTranslation()
  if(!ownerType || !owner)
    return null
  const ownerPath = `/${ownerType}/${owner}/`
  const [ownerCrumb, projectsCrumb] = projectCrumbs(ownerPath, hasTermBrowser(), toV3URL)
  return (
    <span aria-label='breadcrumb' style={{display: 'flex', alignItems: 'center', marginRight: '12px', whiteSpace: 'nowrap'}}>
      <OwnerButton
        ownerType={ownerType}
        owner={owner}
        ownerURL={ownerCrumb.href ? ownerPath : undefined}
        {...(ownerCrumb.href ? {} : {noTooltip: true, component: 'span', disableRipple: true})}
        sx={{
          '.owner-button-label': LABEL_SX,
          '.MuiButton-startIcon': {fontSize: '18px'},
          ...(ownerCrumb.href ? {} : {cursor: 'default'}),
        }}
      />
      <DotSeparator />
      <Button
        href={projectsCrumb.href}
        sx={{textTransform: 'none', color: 'inherit', padding: '4px', minWidth: 'auto', fontSize: '14px', '&:hover': {background: 'transparent', textDecoration: 'underline'}}}
      >
        {t('map_project.mapping_projects')}
      </Button>
    </span>
  )
}

export default MapProjectBreadcrumb
