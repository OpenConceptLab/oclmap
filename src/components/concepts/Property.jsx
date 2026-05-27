import React from 'react'

const Property = ({code, value}) => {
  return (
    <span className='searchable' style={{marginRight: '6px', display: 'inline-block', whiteSpace: 'nowrap'}}><i style={{marginRight: '3px', fontSize: '10px'}}>{code}:</i>{value}</span>
  )
}

export default Property
