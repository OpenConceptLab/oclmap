export const SECONDARY_ACTION_KEYS = ['settings', 'timeline', 'download']

const ACTION_BUTTON_WIDTH = 46
const TIER_DIVIDER_WIDTH = 12
const COLLAPSE_BUFFER_WIDTH = 40
const AUTO_MATCH_FULL_WIDTH = 200

const getRequiredToolbarWidth = (visibleSecondaryCount, hasOverflowItems) => {
  let requiredWidth = ACTION_BUTTON_WIDTH // Save

  if (visibleSecondaryCount > 0) {
    requiredWidth += (visibleSecondaryCount * ACTION_BUTTON_WIDTH) + TIER_DIVIDER_WIDTH
  }

  if (hasOverflowItems) {
    requiredWidth += ACTION_BUTTON_WIDTH + TIER_DIVIDER_WIDTH
  }

  return requiredWidth
}

export const getVisibleSecondaryActionCount = ({ toolbarWidth, hasOverflowItems }) => {
  if (!Number.isFinite(toolbarWidth) || toolbarWidth <= 0) {
    return SECONDARY_ACTION_KEYS.length
  }

  const effectiveToolbarWidth = Math.max(0, toolbarWidth - COLLAPSE_BUFFER_WIDTH)

  for (let visibleCount = SECONDARY_ACTION_KEYS.length; visibleCount >= 0; visibleCount -= 1) {
    const usesOverflow = hasOverflowItems || visibleCount < SECONDARY_ACTION_KEYS.length
    if (effectiveToolbarWidth >= getRequiredToolbarWidth(visibleCount, usesOverflow)) {
      return visibleCount
    }
  }

  return 0
}

export const splitSecondaryActionsByVisibility = ({ toolbarWidth, hasOverflowItems }) => {
  const visibleCount = getVisibleSecondaryActionCount({ toolbarWidth, hasOverflowItems })

  return {
    overflowActionKeys: SECONDARY_ACTION_KEYS.slice(0, SECONDARY_ACTION_KEYS.length - visibleCount),
    visibleActionKeys: SECONDARY_ACTION_KEYS.slice(SECONDARY_ACTION_KEYS.length - visibleCount)
  }
}

const getLayoutStates = hasAutoMatch => {
  const compact = hasAutoMatch ? 'compact' : 'none'
  const states = []
  if (hasAutoMatch) states.push({ autoMatch: 'full', secondaryCount: SECONDARY_ACTION_KEYS.length, save: true })
  for (let count = SECONDARY_ACTION_KEYS.length; count >= 0; count -= 1) {
    states.push({ autoMatch: compact, secondaryCount: count, save: true })
  }
  states.push({ autoMatch: compact, secondaryCount: 0, save: false })
  if (hasAutoMatch) states.push({ autoMatch: 'menu', secondaryCount: 0, save: false })
  return states
}

const getStateWidth = (state, hasOverflowItems) => {
  const usesOverflow = hasOverflowItems || state.secondaryCount < SECONDARY_ACTION_KEYS.length || !state.save || state.autoMatch === 'menu'
  let width = 0
  if (state.autoMatch === 'full') width += AUTO_MATCH_FULL_WIDTH + TIER_DIVIDER_WIDTH
  if (state.autoMatch === 'compact') width += ACTION_BUTTON_WIDTH + TIER_DIVIDER_WIDTH
  if (state.secondaryCount > 0) width += (state.secondaryCount * ACTION_BUTTON_WIDTH) + TIER_DIVIDER_WIDTH
  if (state.save) width += ACTION_BUTTON_WIDTH
  if (usesOverflow) width += ACTION_BUTTON_WIDTH + TIER_DIVIDER_WIDTH
  return width
}

export const getToolbarLayout = ({ toolbarWidth, hasOverflowItems, hasAutoMatch }) => {
  const states = getLayoutStates(hasAutoMatch)
  let state = states[0]
  if (Number.isFinite(toolbarWidth)) {
    const effectiveToolbarWidth = Math.max(0, toolbarWidth - COLLAPSE_BUFFER_WIDTH)
    state = states.find(candidate => effectiveToolbarWidth >= getStateWidth(candidate, hasOverflowItems)) || states[states.length - 1]
  }
  return {
    autoMatch: state.autoMatch,
    saveInMenu: !state.save,
    overflowActionKeys: SECONDARY_ACTION_KEYS.slice(0, SECONDARY_ACTION_KEYS.length - state.secondaryCount),
    visibleActionKeys: SECONDARY_ACTION_KEYS.slice(SECONDARY_ACTION_KEYS.length - state.secondaryCount)
  }
}
