import React from 'react';
import { useTranslation } from 'react-i18next';
import Link from '@mui/material/Link';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { toV3URL } from '../../common/utils';

const MapProjectBreadcrumb = ({ ownerType, owner }) => {
  const { t } = useTranslation()
  if(!ownerType || !owner)
    return null
  const ownerURL = `/${ownerType}/${owner}/`
  return (
    <span aria-label='breadcrumb' style={{display: 'flex', alignItems: 'center', fontSize: '14px', marginRight: '12px', whiteSpace: 'nowrap'}}>
      <Link href={toV3URL(ownerURL)} underline='hover' color='inherit'>{owner}</Link>
      <ChevronRightIcon fontSize='inherit' sx={{margin: '0 4px'}} />
      <Link href={toV3URL(`${ownerURL}map-projects`)} underline='hover' color='inherit'>{t('map_project.mapping_projects')}</Link>
    </span>
  )
}

export default MapProjectBreadcrumb
