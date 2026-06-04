import React from 'react'
import { useTranslation } from 'react-i18next';
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import FilterListIcon from '@mui/icons-material/FilterList';
import InputAdornment from '@mui/material/InputAdornment';
import ClearIcon from '@mui/icons-material/Clear';

import max from 'lodash/max'
import isEmpty from 'lodash/isEmpty'
import values from 'lodash/values'
import flatten from 'lodash/flatten'
import isNaN from 'lodash/isNaN'
import times from 'lodash/times'

import { highlightTexts } from '../../common/utils';
import SearchResults from '../search/SearchResults';
import SearchFilters from '../search/SearchFilters'
import Mappings from './Mappings'
import Concept from './Concept'
import MapButton from './MapButton'

const Search = ({searchStr, setSearchStr, onSearch, repo, repoVersion, concepts, openConceptPanel, showItem, isSelectedForMap, onMap, response, facets, appliedFacets, setAppliedFacets, isLoading, filters, columns, defaultFilters, locales}) => {
  const { t } = useTranslation();
  const [openFilters, setOpenFilters] = React.useState(false)
  const [display, setDisplay] = React.useState('card')
  let total = parseInt(response?.headers?.num_found) || concepts?.length || 0
  const results = {total: total, pageSize: max([parseInt(response?.headers?.num_returned), 5]), page: parseInt(response?.headers?.page_number), pages: parseInt(response?.headers?.pages), results: response?.data || []}

  const onKeyPress = event => {
    if(event.key === 'Enter') {
      if(searchStr)
        onSearch(event)
    }
  }

  const getExtraColumns = () => {
    let cols = [
      {
        sortable: false,
        id: 'mappings',
        labelKey: 'common.action',
        align: 'center',
        renderer: item => {
          return (
            <MapButton
              simple
              selected={item?.search_meta?.map_type}
              onClick={(event, applied, mapType) => onMap(event, item, !applied, mapType)}
              isMapped={isSelectedForMap(item)}
              sx={{marginLeft: '8px'}}
            />
          )
        },
      },
    ]
    if(display === 'card')
      cols = [
        {
          sortable: false,
          id: 'mappings',
          labelKey: 'mapping.same_as_mappings',
          renderer: item => <Mappings item={item} />,
        },
        ...cols
      ]
    return cols
  }

  return (
    <div className='col-xs-12 padding-0'>
      <div className='col-xs-12 padding-0' style={{display: 'flex', alignItems: 'center'}}>
        <IconButton color={(isEmpty(appliedFacets) && !openFilters) ? undefined : 'primary'} style={{marginRight: '4px'}} onClick={() => setOpenFilters(!openFilters)} disabled={isEmpty(facets)}>
          <Badge badgeContent={flatten(values(appliedFacets).map(v => values(v))).length} color='primary'>
            <FilterListIcon sx={{color: (isEmpty(appliedFacets) && !openFilters) ? '#000': 'primary'}} />
          </Badge>
        </IconButton>
        <TextField
          autoFocus
          label={t('common.search')}
          sx={{width: 'calc(100% - 132px)'}}
          required
          id="search"
          value={searchStr}
          onChange={event => setSearchStr(event.target.value || '')}
          size='small'
          onKeyDown={onKeyPress}
          slotProps={{
            input: {
              endAdornment: (
                searchStr ?
                  <InputAdornment position="end">
                    <IconButton color='secondary' onClick={() => setSearchStr('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                : undefined
              ),
            },
          }}
        />
        <Button
          color='primary'
          variant="contained"
          sx={{textTransform: 'none', marginLeft: '10px'}}
          disabled={!repo?.id || !repoVersion?.id || !searchStr}
          onClick={onSearch}
        >
          {t('common.search')}
        </Button>
      </div>
      <div className='col-xs-12 padding-0' style={{display: 'flex'}}>
        {
          !isEmpty(facets) &&
            <div className='col-xs-4 padding-0' style={openFilters ? {borderRight: '1px solid lightgray'} : {width: 0, display: 'none'}}>
              <SearchFilters
                open={openFilters}
                resource='concepts'
                filters={facets}
                appliedFilters={appliedFacets || {}}
                onChange={setAppliedFacets}
                repoDefaultFilters={filters}
                defaultFilters={defaultFilters}
                properties={repoVersion?.meta?.display?.concept_summary_properties}
                propertyFilters={repoVersion?.filters}
                heightToSubtract={523}
                columns={columns}
            />
          </div>
        }
        {
          isLoading && results?.total === 0 ?
            <div style={{width: openFilters ? '66%' : '100%', paddingLeft: openFilters ? '8px' : 0}}>
              {
                times(25, i => (
                  <Skeleton height={58} key={i} />
                ))
              }
            </div> :
          <SearchResults
            locales={locales}
          resultsContainerId='search-results'
          resultSize='small'
          sx={{
            width: openFilters ? '66%' : '100%',
            borderRadius: '10px 10px 0 0',
            '.MuiTableCell-root': {
              padding: '6px !important',
              verticalAlign: 'top'
            },
            '.MuiTableCell-head': {
              padding: '2px 6px !important',
              whiteSpace: 'normal',
              verticalAlign: 'middle'
            },
            '.MuiToolbar-root': {
              borderRadius: '10px 10px 0 0',
              padding: '0 8px'
            }
          }}
          renderer={
            props => {
              if(isLoading) return <Skeleton height={58} key={props?.key} />
              // Bypass SearchResults.handleRowClick row-id lookup — its find
              // matches by row.version_url/url/id, but the click id we send
              // (conceptDefinition.ocl_url) is the unversioned URL while
              // search results carry version_url. The find returns false and
              // would close the panel. Pass the row straight to
              // openConceptPanel, which checks the current row's candidates
              // for cross-tab enrichment.
              const row = props?.concept
              const onCardClick = openConceptPanel
                ? (event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    openConceptPanel(row, {fromCrossTab: true})
                    setTimeout(() => { highlightTexts([row], null, false) }, 100)
                  }
                : props.onCardClick
              return (
                <Concept
                  {...props}
                  onCardClick={onCardClick}
                  onMap={onMap}
                  isSelectedForMap={isSelectedForMap}
                  repoVersion={repoVersion}
                  noScore
                  locales={locales}
                />
              )
            }
          }
          display={display}
          onDisplayChange={setDisplay}
          nested
          results={results}
          resource='concepts'
          noSorting
          noToolbar={results?.results?.length === 0}
          noPagination={results?.results?.length === 0}
          searchedText={searchStr}
          noResults={!isLoading && !isNaN(results.page) && results?.results?.length === 0}
          loading={isLoading}
          resultContainerStyle={{height: 'calc(100vh - 602px)', overflow: 'auto'}}
          onShowItemSelect={item => {
            // fromCrossTab: true → openConceptPanel checks if this concept
            // is also a candidate for the current row; if so, enriches the
            // payload with multi-algo + bridge context and surfaces the
            // "Also a candidate for [code]" chip in the header.
            openConceptPanel(item, {fromCrossTab: true})
            setTimeout(() => {
              highlightTexts([item], null, false)
            }, 100)
          }}
          selectedToShow={showItem}
          onPageChange={(page, pageSize) => onSearch(null, page, pageSize)}
          extraColumns={getExtraColumns()}
          repoDefaultFilters={repoVersion?.meta?.display?.default_filter}
          properties={repoVersion?.meta?.display?.concept_summary_properties}
          propertyFilters={repoVersion?.filters}
        />
        }
      </div>
    </div>

  )
}

export default Search
