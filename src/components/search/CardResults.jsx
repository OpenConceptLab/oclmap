import React from 'react';
import { map } from 'lodash';
import ConceptCard from '../concepts/ConceptCard';

const CardResults = ({bgColor, handleClick, handleRowClick, results, resource, isSelected, isItemShown, className, isSplitView, style, renderer, selected, id}) => {
  const rows = results?.results || []
  return (
    <div id={id} className={'col-xs-12 padding-0 ' + (className || '')} style={style || {height: 'calc(var(--app-height) - 275px)', overflowX: 'auto'}}>
      {
        resource === 'concepts' && map(rows, (row, index) => {
          let props = {
            firstChild: index === 0,
            lastChild: index === (rows.length - 1),
            isSelected: isSelected,
            selected: selected,
            isShown: isItemShown,
            bgColor: bgColor,
            key: index,
            onSelect: handleClick,
            onCardClick: handleRowClick,
            isSplitView: isSplitView,
            concept: row
          }
          return renderer ? renderer(props) : <ConceptCard {...props} />
        })
      }
    </div>
  )
}

export default CardResults;
