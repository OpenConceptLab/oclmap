import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';

import ConceptHome from '../concepts/ConceptHome';
import Breadcrumbs from '../common/Breadcrumbs';
import { toParentURI, toV3URL } from '../../common/utils';
import { BLACK } from '../../common/colors';
import { MAP_TYPE_CHIP_SX } from './Concept';
import { getScoreDetails, ScoreValueChip } from './Score';
import MapButton from './MapButton';
import { conceptForMapping } from './viewBuilders.js';

// Bridge Concepts tab — one accordion entry per bridge contributor that
// converged on the same target concept (built by openConceptPanel.allBridgesFor).
//
// Header / detail consistency: the accordion SUMMARY renders the same
// ConceptHeader-style layout as the Concept Details tab (Breadcrumbs +
// large display name) — so users see one consistent way to display a
// concept across the whole panel. The accordion DETAILS skip the inner
// ConceptHome header (via `hideHeader`) to avoid duplicating it.
//
// First entry is expanded by default. Subsequent entries collapsed.
//
// Map-type and algorithm chips use the project-wide MAP_TYPE_CHIP_SX
// styling from Concept.jsx so they look identical to the candidates list.

const owner_typeFromURL = url => {
  // /orgs/CIEL/sources/CIEL/concepts/21/ -> "orgs"
  // /users/joe/sources/.../concepts/.../ -> "users"
  if(!url) return null
  const seg = url.split('/').filter(Boolean)[0]
  return seg === 'orgs' || seg === 'users' ? seg : null
}

const ownerFromURL = url => {
  if(!url) return null
  return url.split('/').filter(Boolean)[1] || null
}

// `entry.conceptDefinition` is the concept this row represents. Backward-
// compatible: also accepts `entry.bridgeConceptDefinition` for older call
// sites that haven't migrated yet.
const BridgeAccordionSummary = ({entry, candidatesScore, allowMapping, onMap, isSelectedForMap}) => {
  const { t } = useTranslation()
  const def = entry?.conceptDefinition || entry?.bridgeConceptDefinition
  if(!def) return null
  const ocl_url = def.ocl_url
  const repoURL = ocl_url ? toParentURI(ocl_url) : null
  const id = def.id || def.reference?.code
  const owner = def.owner || ownerFromURL(ocl_url)
  const owner_type = def.owner_type || owner_typeFromURL(ocl_url)
  const conceptStub = { id, retired: Boolean(def.retired) }
  // toV3URL already prepends the SPA hash; pass the bare relative URL.
  const termBrowserUrl = ocl_url ? toV3URL(ocl_url) : null
  const { hasPercentile, algoScore, rerankScore, bucketColor } = getScoreDetails({
    candidate: entry?.candidate,
    conceptRow: entry?.conceptRow,
  }, candidatesScore)
  const scoreLabel = rerankScore || algoScore
  const conceptToMap = allowMapping && entry?.candidate
    ? conceptForMapping({
        candidate: entry.candidate,
        conceptDefinition: def,
        conceptRow: entry?.conceptRow,
      })
    : null
  const isMapped = conceptToMap && isSelectedForMap ? isSelectedForMap(conceptToMap) : false
  return (
    <Box sx={{width: '100%'}}>
      <Stack
        direction='row'
        alignItems='center'
        justifyContent='space-between'
        spacing={1}
        sx={{width: '100%', flexWrap: 'wrap'}}
      >
        <Box sx={{flexGrow: 1, minWidth: 0, overflow: 'hidden'}}>
          <Breadcrumbs
            ownerURL={repoURL ? `/${owner_type}/${owner}/` : false}
            owner={owner}
            ownerType={owner_type}
            repo={def.source}
            repoURL={repoURL}
            concept={conceptStub}
          />
        </Box>
        <Stack direction='row' alignItems='center' spacing={0.5} sx={{flexShrink: 0}}>
          {
            entry.map_type &&
              <Chip size='small' label={entry.map_type} sx={MAP_TYPE_CHIP_SX} />
          }
          {
            entry.algorithm_id &&
              <Chip size='small' label={entry.algorithm_id} variant='outlined' color='warning' />
          }
          {
            scoreLabel && (
              <ScoreValueChip
                size='small'
                bucketColor={bucketColor}
                label={scoreLabel}
                sx={{
                  backgroundColor: hasPercentile ? undefined : 'rgba(0, 0, 0, 0.08)',
                  color: 'surface.dark',
                  fontWeight: 600,
                }}
              />
            )
          }
          {
            termBrowserUrl && (
              <Tooltip title={t('concept.open_in_term_browser')}>
                <IconButton
                  size='small'
                  color='secondary'
                  href={termBrowserUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  // The summary is the accordion toggle; don't collapse/expand
                  // when the user clicks the TermBrowser link.
                  onClick={e => e.stopPropagation()}
                  aria-label={t('concept.open_in_term_browser')}
                >
                  <OpenInNewIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            )
          }
        </Stack>
      </Stack>
      {
        (def.display_name || conceptToMap) && (
          <Stack
            direction='row'
            alignItems='flex-start'
            justifyContent='space-between'
            spacing={1}
            sx={{marginTop: '4px', width: '100%'}}
          >
            <Typography sx={{fontSize: '22px', color: BLACK, flexGrow: 1, minWidth: 0}} className='searchable'>
              {def.display_name}
            </Typography>
            {
              conceptToMap && onMap && isSelectedForMap && (
                <Box sx={{flexShrink: 0}} onClick={e => e.stopPropagation()}>
                  <MapButton
                    simple
                    selected={entry?.candidate?.map_type || entry?.map_type}
                    isMapped={isMapped}
                    onClick={(event, applied, mapType) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onMap(event, conceptToMap, !applied, entry?.candidate?.map_type || mapType)
                    }}
                    sx={{marginLeft: '8px'}}
                  />
                </Box>
              )
            }
          </Stack>
        )
      }
    </Box>
  )
}

// Renders either:
//   - Bridge intermediaries that found the target (entries from
//     openConceptPanel.allBridgesFor, shape {bridgeConceptDefinition, ...})
//   - Bridge children (cascade targets a bridge resolves to, shape
//     {conceptDefinition, ...})
// Both shapes are accepted via BridgeAccordionSummary's def lookup.
const BridgeConceptsTab = ({
  bridges,
  effectiveLocales,
  linkedConceptUrls,
  linkedConceptLabel,
  onMap,
  isSelectedForMap,
  allowMapping = false,
  candidatesScore,
}) => {
  if(!bridges?.length) return null

  return (
    <Box sx={{padding: 1}}>
      {bridges.map((entry, idx) => {
        const def = entry?.conceptDefinition || entry?.bridgeConceptDefinition
        const key = def?.ocl_url || def?.id || `bridge-${idx}`
        return (
          <Accordion key={key} defaultExpanded={idx === 0} disableGutters sx={{marginBottom: 1}}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                '& .MuiAccordionSummary-content': {
                  marginRight: 1,
                  alignItems: 'flex-start',
                }
              }}
            >
              <BridgeAccordionSummary
                entry={entry}
                candidatesScore={candidatesScore}
                allowMapping={allowMapping}
                onMap={onMap}
                isSelectedForMap={isSelectedForMap}
              />
            </AccordionSummary>
            {/* Tint the expanded details with the Mapper page gray (surface.n96 /
                BG_GRAY — the app body background) so the collapsible region reads as
                inset — the summary (breadcrumb + display name) and the modal stay white.
                `display: flow-root` is required: ConceptHome's content is a floated
                Bootstrap `col-xs-12`, so without a block-formatting context the details
                box collapses to ~0 height and the gray paints nothing. */}
            <AccordionDetails sx={{padding: 0, display: 'flow-root', borderTop: '1px solid', borderColor: 'surface.n92', backgroundColor: 'surface.n96'}}>
              <ConceptHome
                hideHeader
                hideClose
                hideDragHandle
                nested
                url={def?.ocl_url}
                concept={{
                  id: def?.id || def?.reference?.code,
                  display_name: def?.display_name,
                  url: def?.ocl_url,
                  source: def?.source,
                  type: 'Concept',
                  search_meta: {
                    algorithm: entry?.candidate?.algorithm_id,
                    search_score: entry?.candidate?.score,
                    search_normalized_score: entry?.conceptRow?.rerank_score,
                    search_highlight: entry?.candidate?.highlights,
                    map_type: entry?.candidate?.map_type || entry?.map_type,
                  },
                }}
                effectiveLocales={effectiveLocales}
                linkedConceptUrls={linkedConceptUrls}
                linkedConceptLabel={linkedConceptLabel}
                onClose={() => {}}
                onMap={allowMapping ? onMap : undefined}
                isSelectedForMap={allowMapping ? isSelectedForMap : undefined}
                candidatesScore={candidatesScore}
                detailsStyle={{height: 'auto'}}
              />
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Box>
  )
}

export default BridgeConceptsTab
