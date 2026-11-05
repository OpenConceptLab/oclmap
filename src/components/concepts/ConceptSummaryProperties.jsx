import React from 'react'
import Property from '../concepts/Property'

import startCase from 'lodash/startCase'
import find from 'lodash/find'
import map from 'lodash/map'
import { getPropertyLabel, getPropertyValue } from './propertyValue'


const ConceptSummaryProperties = ({concept, repoVersion}) => {
  const getProperties = () => {
    const summaryProperties = repoVersion?.meta?.display?.concept_summary_properties || []
    if(summaryProperties?.length > 0) {
      let values = []
      summaryProperties.forEach(code => {
        let property = find(concept?.property, {code: code})
        if(property){
          const label = getPropertyLabel(property, ['concept_class', 'datatype'].includes(code) ? startCase(code) : undefined)
          values.push(<Property key={label} code={label} value={getPropertyValue(property)} />)
        }
      })
      return values
    }
    return [
      <Property key={1} code='Concept Class' value={concept.concept_class} />,
      <Property key={2} code='Datatype' value={concept.datatype} />,
    ]
  }

  return (
    <>
      {map(getProperties(), prop => prop)}
    </>
  )
}

export default ConceptSummaryProperties
