export const SECONDARY_ACTION_KEYS = ['settings', 'timeline', 'download']

const ACTION_BUTTON_WIDTH = 46
const TIER_DIVIDER_WIDTH = 12
const COLLAPSE_BUFFER_WIDTH = 40

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
