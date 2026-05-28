import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import ConceptHome from '../concepts/ConceptHome';
import Breadcrumbs from '../common/Breadcrumbs';
import { toParentURI } from '../../common/utils';
import { BLACK } from '../../common/colors';
import { MAP_TYPE_CHIP_SX } from './Concept';

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
const BridgeAccordionSummary = ({entry}) => {
  const def = entry?.conceptDefinition || entry?.bridgeConceptDefinition
  if(!def) return null
  const ocl_url = def.ocl_url
  const repoURL = ocl_url ? toParentURI(ocl_url) : null
  const id = def.id || def.reference?.code
  const owner = def.owner || ownerFromURL(ocl_url)
  const owner_type = def.owner_type || owner_typeFromURL(ocl_url)
  const conceptStub = { id, retired: Boolean(def.retired) }
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
        </Stack>
      </Stack>
      {
        def.display_name && (
          <Typography sx={{fontSize: '22px', color: BLACK, marginTop: '4px'}} className='searchable'>
            {def.display_name}
          </Typography>
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
const BridgeConceptsTab = ({bridges, effectiveLocales, linkedConceptUrls, linkedConceptLabel}) => {
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
              <BridgeAccordionSummary entry={entry} />
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
                }}
                effectiveLocales={effectiveLocales}
                linkedConceptUrls={linkedConceptUrls}
                linkedConceptLabel={linkedConceptLabel}
                onClose={() => {}}
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
