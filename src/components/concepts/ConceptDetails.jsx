import React from 'react'
import { useTranslation } from 'react-i18next';
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import has from 'lodash/has'
import { formatDateTime } from '../../common/utils'
import Link from '../common/Link'
import Locales from './Locales'
import Associations from './Associations'
import ConceptProperties from './ConceptProperties'
import ExternalIdLabel from '../common/ExternalIdLabel'

const borderColor = 'rgba(0, 0, 0, 0.12)'

const ConceptDetails = ({ concept, repo, mappings, reverseMappings, loading, loadingOwnerMappings, ownerMappings, reverseOwnerMappings, onLoadOwnerMappings, style, effectiveLocales, linkedConceptUrls, linkedConceptLabel }) => {
  const { t } = useTranslation()
  const updatedBy = concept?.version_updated_by || concept?.updated_by
  return (
    <div className='col-xs-12' style={{padding: '16px 0', height: 'calc(100vh - 245px)', overflow: 'auto', ...style}}>
      {
        has(concept, 'concept_class') ?
          <Paper className='col-xs-12 padding-0' sx={{boxShadow: 'none', border: '1px solid', borderColor: borderColor, borderRadius: '10px'}}>
            <Typography component='span' sx={{borderBottom: '1px solid', borderColor: borderColor, padding: '12px 16px', fontSize: '16px', color: 'surface.contrastText', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold'}}>
              {t('common.properties')}
            </Typography>
            <ConceptProperties concept={concept} />
          </Paper> :
        <Skeleton variant="rounded" width='100%' height={120} sx={{borderRadius: '10px'}} />

      }
      {
          Boolean(concept.names?.length) &&
            <div className='col-xs-12 padding-0' style={{marginTop: '16px'}}>
              <Locales
                concept={concept}
                locales={concept.names}
                title={t('concept.name_and_synonyms')}
                repo={repo}
                effectiveLocales={effectiveLocales}
                collapsible
              />
            </div>
      }
      {
        Boolean(concept.descriptions?.length) &&
          <div className='col-xs-12 padding-0' style={{marginTop: '16px'}}>
            <Locales
              concept={concept}
              locales={concept.descriptions}
              title={t('concept.descriptions')}
              repo={repo}
              effectiveLocales={effectiveLocales}
              collapsible
            />
          </div>
      }
      <div className='col-xs-12 padding-0' style={{marginTop: '16px'}}>
        {
          loading ?
          <Skeleton variant="rounded" width='100%' height={120} sx={{borderRadius: '10px'}} /> :
          <Associations concept={concept} mappings={mappings} reverseMappings={reverseMappings} ownerMappings={ownerMappings} reverseOwnerMappings={reverseOwnerMappings} onLoadOwnerMappings={onLoadOwnerMappings} loadingOwnerMappings={loadingOwnerMappings} linkedConceptUrls={linkedConceptUrls} linkedConceptLabel={linkedConceptLabel} />
        }
      </div>
      <div className='col-xs-12 padding-0' style={{marginTop: '32px'}}>
        {
          concept?.external_id &&
            <Typography component='span' sx={{display: 'inline-flex', alignItems: 'center', padding: 0, fontSize: '12px', color: 'surface.contrastText', width: '100%', }}>
              {t('common.external_id')}: {
                loading ?
                  <Skeleton variant='text' width='40%' sx={{marginLeft: '8px', fontSize: '12px', display: 'inline-block'}} />:
                <ExternalIdLabel value={concept.external_id} showFull valueOnly valueStyle={{color: 'rgba(0, 0, 0, 0.87)', marginLeft: '2px'}} />
              }
            </Typography>
        }
      <Typography component='span' sx={{display: 'inline-block', padding: 0, fontSize: '12px', color: 'surface.contrastText', width: '100%'}}>
        {t('common.last_updated')} {
          loading ?
            <Skeleton variant='text' width='40%' sx={{marginLeft: '8px', fontSize: '12px', display: 'inline-block'}} />:
          <>{formatDateTime(concept.versioned_updated_on || concept.updated_on)} {t('common.by')} <Link sx={{fontSize: '12px', justifyContent: 'flex-start'}} href={`#/users/${updatedBy}`} label={updatedBy} /></>
        }
      </Typography>
      <Typography component='span' sx={{display: 'inline-block', padding: 0, fontSize: '12px', color: 'surface.contrastText', width: '100%'}}>
        {t('checksums.standard')} {
          !concept?.checksums?.standard ?
            <Skeleton variant='text' width='40%' sx={{marginLeft: '8px', fontSize: '12px', display: 'inline-block'}} />:
          concept?.checksums?.standard
        }
      </Typography>
      <Typography component='span' sx={{display: 'inline-block', padding: 0, fontSize: '12px', color: 'surface.contrastText', width: '100%', marginBottom: '12px'}}>
        {t('checksums.smart')} {
          !concept?.checksums?.smart ?
            <Skeleton variant='text' width='40%' sx={{marginLeft: '8px', fontSize: '12px', display: 'inline-block'}} />:
          concept?.checksums?.smart
        }
      </Typography>
    </div>
    </div>
  )
}

export default ConceptDetails;
