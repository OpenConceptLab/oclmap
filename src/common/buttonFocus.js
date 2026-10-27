// Theme settings for focused and hovered buttons (OpenConceptLab/ocl_issues#2970),
// in a plain .js module so the integration test can import them.
//
// MUI's focus ripple pulses a circle of the text color at 30% behind the label,
// which drops the label below 4.5:1. Keyboard focus shows a two-tone ring
// instead: `inner` next to the button, `outer` around it. The click ripple stays.
export const buttonFocusComponents = (inner, outer) => {
  const ring = `0 0 0 2px ${inner}, 0 0 0 4px ${outer}`
  return {
    MuiButton: {
      defaultProps: {
        disableFocusRipple: true,
      },
      styleOverrides: {
        root: {
          // Theme overrides come after MUI's own styles, so this replaces a
          // contained button's focus elevation.
          '&.Mui-focusVisible': {
            boxShadow: ring,
          },
          // On a contained button rendered as a link, Bootstrap 3's
          // `a:hover, a:focus` color and underline outrank MUI's (an element
          // and a class beat one class). This restores MUI's text color.
          'a&.MuiButton-contained:hover, a&.MuiButton-contained:focus': {
            color: 'var(--variant-containedColor)',
            textDecoration: 'none',
          },
        },
      },
    },
    MuiButtonGroup: {
      styleOverrides: {
        grouped: {
          // A contained group sets `box-shadow: none` on its buttons, as
          // specific as the rule above. Raised so the next button can't cover
          // the ring's edge.
          '&.Mui-focusVisible': {
            boxShadow: ring,
            zIndex: 1,
          },
        },
      },
    },
  }
}
