import React from 'react'
import Slider from '@mui/material/Slider'
import { SCORES_COLOR } from './constants'
const ScoreConfiguration = ({scores, onChange, disabled}) => {
  const _onChange = (event, newValues) => {
    if(newValues[0] === newValues[1] || newValues[1] <= newValues[0])
      return
    onChange({recommended: newValues[1], available: newValues[0]})
  }
  return (
    <div className='col-xs-12'>
      <Slider
        sx={{
          '.MuiSlider-track': {
            backgroundColor: SCORES_COLOR.available,
            border: `1px solid ${SCORES_COLOR.available}`
          },
          '.MuiSlider-rail': {
            backgroundColor: SCORES_COLOR.recommended,
          },
          '.MuiSlider-thumb[data-index="0"]': {
            backgroundColor: SCORES_COLOR.low_ranked
          },
          '.MuiSlider-thumb[data-index="1"]': {
            backgroundColor: SCORES_COLOR.recommended
          }
        }}
        value={[scores.available, scores.recommended]}
        onChange={_onChange}
        valueLabelDisplay="auto"
        disabled={disabled}
        step={1}
        marks
        disableSwap
      />
    </div>
  )
}

export default ScoreConfiguration
