import React from 'react';
import { useTranslation } from 'react-i18next';

import Dialog from '@mui/material/Dialog';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';

import ConceptHome from '../concepts/ConceptHome';
import CloseIconButton from '../common/CloseIconButton';
import DraggablePaperComponent from '../common/DraggablePaperComponent';
import MatchDetailsPanel from './MatchDetailsPanel';
import BridgeConceptsTab from './BridgeConceptsTab';
import { allBridgesFor } from './openConceptPanel';

const TAB_STYLES = { textTransform: 'none' }

// Wrapper that owns the dialog chrome, the tab bar, and lazy-mounts each tab
// body. Tab visibility is data-driven from `payload.panelContext.enrichment`
// (or the legacy search_meta / bridge_concept fields when there's no
// enrichment — e.g. a bare Search-tab click).
//
// Tab set:
//   - Concept Details  — always (the candidate concept itself)
//   - Bridge Concept(s) — if any bridges contributed
//   - Match Details    — if any score/highlight metadata exists
//
// Render strategy: lazy-mount per tab. The first time a tab is visited, its
// body is rendered and kept mounted thereafter (caches the ConceptHome
// cascade fetch). Prevents firing 2x $cascade calls per panel open.
//
// Dialog chrome:
//   - Fixed height (85vh) so the dialog doesn't re-center vertically when
//     the user switches tabs — Material UI's Dialog auto-centers on content
//     height changes otherwise.
//   - Tab bar carries the drag handle (`#draggable-dialog-title`) and an
//     always-visible close button. ConceptHome's inner close is suppressed
//     via `hideClose` so we don't have two X buttons.

const TabLabel = ({ label, count }) => (
  count ? (
    <Badge
      color='primary'
      badgeContent={count}
      sx={{
        '& .MuiBadge-badge': {
          position: 'relative',
          transform: 'none',
          marginLeft: '8px',
          minWidth: '20px',
          height: '20px',
          fontSize: '11px',
          fontWeight: 600,
        }
      }}
    >
      <span>{label}</span>
    </Badge>
  ) : <span>{label}</span>
)

const ConceptDetailsPanel = ({
  payload,
  onClose,
  onMap,
  isSelectedForMap,
  candidatesScore,
  repoVersion,
  effectiveLocales,
}) => {
  const { t } = useTranslation()

  const open = Boolean(payload?.id || payload?.url)

  const enrichment = payload?.panelContext?.enrichment
  const isBridgeIntermediary = Boolean(payload?.panelContext?.isBridgeIntermediary)
  const isBridgeTarget = Boolean(payload?.bridge_concept) && !isBridgeIntermediary
  const bridgeChildren = payload?.panelContext?.bridgeChildren || []
  const bridges = React.useMemo(() => allBridgesFor(payload), [payload])

  // The middle tab is polymorphic: when the panel concept is a bridge
  // intermediary it lists cascade children (concepts the bridge resolves
  // to); otherwise it lists bridge contributors (intermediaries that found
  // this target concept). Same accordion UI either way.
  const middleEntries = isBridgeIntermediary ? bridgeChildren : bridges
  const hasMiddleTab = middleEntries.length > 0

  // Cross-tab association highlights:
  //   - On Concept Details tab (target candidate): highlight mappings
  //     to/from bridge intermediaries that contributed to this candidate.
  //   - On Bridge Concept Details tab (intermediary): highlight mappings
  //     to/from the bridge children.
  //   - On Bridge Concepts / Bridge Children tabs: highlight the panel
  //     concept (the other end of the relationship).
  const middleConceptUrls = React.useMemo(
    () => middleEntries
      .map(e => (e.conceptDefinition || e.bridgeConceptDefinition)?.ocl_url)
      .filter(Boolean),
    [middleEntries]
  )
  const panelConceptUrl = payload?.url

  const hasMatchData = Boolean(
    enrichment?.contributingAlgorithms?.length ||
    payload?.search_meta?.search_score ||
    payload?.search_meta?.search_highlight
  )

  const tabs = React.useMemo(() => {
    const conceptLabel = isBridgeIntermediary
      ? t('concept.tab_bridge_concept')
      : (isBridgeTarget ? t('mapping.toConcept') : t('concept.tab_concept_details'))
    const list = [{ key: 'concept', label: conceptLabel }]
    if(hasMiddleTab) {
      if(isBridgeIntermediary) {
        list.push({
          key: 'bridges',
          label: t('concept.tab_bridge_children'),
          count: middleEntries.length > 1 ? middleEntries.length : null,
        })
      } else {
        list.push({
          key: 'bridges',
          label: middleEntries.length === 1
            ? t('concept.tab_bridge_concept')
            : t('concept.tab_bridge_concepts'),
          count: middleEntries.length > 1 ? middleEntries.length : null,
        })
      }
    }
    if(hasMatchData) list.push({ key: 'match', label: t('search.search_highlight') })
    return list
  }, [hasMiddleTab, hasMatchData, middleEntries.length, isBridgeIntermediary, isBridgeTarget, t])

  const initialKey = React.useMemo(() => {
    if(payload?.initialTab && tabs.some(tab => tab.key === payload.initialTab))
      return payload.initialTab
    return tabs[0]?.key || 'concept'
  }, [payload?.initialTab, tabs])

  const [activeTab, setActiveTab] = React.useState(initialKey)
  const [mounted, setMounted] = React.useState(() => new Set([initialKey]))

  const identityKey = payload?.url || payload?.id || null
  const lastIdentityRef = React.useRef(identityKey)
  React.useEffect(() => {
    if(identityKey !== lastIdentityRef.current) {
      lastIdentityRef.current = identityKey
      setActiveTab(initialKey)
      setMounted(new Set([initialKey]))
    }
  }, [identityKey, initialKey])

  const handleTabChange = (event, newTab) => {
    setActiveTab(newTab)
    setMounted(prev => {
      if(prev.has(newTab)) return prev
      const next = new Set(prev)
      next.add(newTab)
      return next
    })
  }

  if(!open) return null

  const panelRepo = payload?.source === (repoVersion?.short_code || repoVersion?.id) ? repoVersion : null

  return (
    <Dialog
      PaperComponent={DraggablePaperComponent}
      aria-labelledby='draggable-dialog-title'
      open
      onClose={onClose}
      scroll='paper'
      maxWidth='sm'
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '28px',
          padding: 0,
          height: '85vh',
          maxHeight: '85vh',
          overflow: 'hidden',
        }
      }}
    >
      <Box
        id='draggable-dialog-title'
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'surface.n96',
          borderBottom: '1px solid',
          borderColor: 'surface.n90',
          cursor: 'move',
          flexShrink: 0,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor='primary'
          variant={tabs.length > 1 ? 'fullWidth' : 'standard'}
          aria-label='concept details panel tabs'
          sx={{flexGrow: 1, minHeight: 48}}
        >
          {tabs.map(tab => (
            <Tab
              key={tab.key}
              value={tab.key}
              label={<TabLabel label={tab.label} count={tab.count} />}
              sx={TAB_STYLES}
            />
          ))}
        </Tabs>
        <Box sx={{paddingRight: 1, display: 'flex', alignItems: 'center'}}>
          <CloseIconButton color='secondary' onClick={onClose} />
        </Box>
      </Box>

      <Box sx={{flexGrow: 1, overflow: 'auto', minHeight: 0}}>
        {/* Concept Details — the candidate concept itself. */}
        {
          mounted.has('concept') && (
            <Box sx={{display: activeTab === 'concept' ? 'block' : 'none'}}>
              <ConceptHome
                hideClose
                hideDragHandle
                style={{borderRadius: 0}}
                detailsStyle={{height: 'auto'}}
                repo={panelRepo}
                url={payload?.url}
                concept={payload}
                aiRecommended={payload?.panelContext?.isAIRecommended}
                aiAlternate={payload?.panelContext?.isAIAlternate}
                crossRowCode={payload?.panelContext?.fromCrossTab ? payload?.panelContext?.currentRowCode : undefined}
                effectiveLocales={effectiveLocales}
                linkedConceptUrls={middleConceptUrls}
                linkedConceptLabel={
                  isBridgeIntermediary
                    ? t('concept.linked_bridge_child')
                    : t('concept.linked_bridge_concept')
                }
                onClose={onClose}
                onMap={panelRepo ? onMap : undefined}
                isSelectedForMap={panelRepo ? isSelectedForMap : undefined}
                candidatesScore={candidatesScore}
              />
            </Box>
          )
        }

        {/* Middle tab — Bridge Concepts (intermediaries → target) OR
            Bridge Children (intermediary → cascade targets). Same accordion
            UI; the data shape switches based on isBridgeIntermediary. */}
        {
          hasMiddleTab && mounted.has('bridges') && (
            <Box sx={{display: activeTab === 'bridges' ? 'block' : 'none'}}>
              <BridgeConceptsTab
                bridges={middleEntries}
                effectiveLocales={effectiveLocales}
                linkedConceptUrls={panelConceptUrl ? [panelConceptUrl] : []}
                linkedConceptLabel={
                  isBridgeIntermediary
                    ? t('concept.linked_bridge_concept')
                    : t('concept.linked_target_concept')
                }
                onMap={onMap}
                isSelectedForMap={isSelectedForMap}
                allowMapping={isBridgeIntermediary}
                candidatesScore={candidatesScore}
              />
            </Box>
          )
        }

        {/* Match Details — unified + per-algorithm scores + highlights. */}
        {
          hasMatchData && mounted.has('match') && (
            <Box sx={{display: activeTab === 'match' ? 'block' : 'none'}}>
              <MatchDetailsPanel
                concept={payload}
                contributingAlgorithms={enrichment?.contributingAlgorithms}
                candidatesScore={candidatesScore}
              />
            </Box>
          )
        }
      </Box>
    </Dialog>
  )
}

export default ConceptDetailsPanel
