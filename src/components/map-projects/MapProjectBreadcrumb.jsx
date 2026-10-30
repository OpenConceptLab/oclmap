import React from 'react';
import { useTranslation } from 'react-i18next';
import Link from '@mui/material/Link';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { hasTermBrowser, toV3URL } from '../../common/utils';
import { projectCrumbs } from '../../common/breadcrumb';

const MapProjectBreadcrumb = ({ ownerType, owner }) => {
  const { t } = useTranslation()
  if(!ownerType || !owner)
    return null
  const [ownerCrumb, projectsCrumb] = projectCrumbs(`/${ownerType}/${owner}/`, hasTermBrowser(), toV3URL)
  return (
    <span aria-label='breadcrumb' style={{display: 'flex', alignItems: 'center', fontSize: '14px', marginRight: '12px', whiteSpace: 'nowrap'}}>
      {ownerCrumb.href ? <Link href={ownerCrumb.href} underline='hover' color='inherit'>{owner}</Link> : <span>{owner}</span>}
      <ChevronRightIcon fontSize='inherit' sx={{margin: '0 4px'}} />
      <Link href={projectsCrumb.href} underline='hover' color='inherit'>{t('map_project.mapping_projects')}</Link>
    </span>
  )
}

export default MapProjectBreadcrumb
