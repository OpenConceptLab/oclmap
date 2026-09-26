import React from 'react';
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Checkbox from '@mui/material/Checkbox';
import Skeleton from '@mui/material/Skeleton'
import { visuallyHidden } from '@mui/utils';
import { filter, reject, get, sortBy, without, startCase, find, keys, map, times } from 'lodash'
import { SECONDARY_COLORS } from '../../common/colors';
import { ALL_COLUMNS } from './ResultConstants';

const EnhancedTableHead = props => {
  const { t } = useTranslation()
  const { onSelectAllClick, order, orderBy, numSelected, rowCount, onRequestSort, columns } = props;
  const createSortHandler = property => event => {
    onRequestSort(event, property);
  };
  return (
    <TableHead sx={{background: props.bgColor}}>
      <TableRow sx={{background: '#FFF'}}>
        {
          onSelectAllClick &&
            <TableCell padding="checkbox" sx={{background: 'inherit'}}>
              <Checkbox
                size={props.size || 'medium'}
                color="primary"
                indeterminate={numSelected > 0 && numSelected < rowCount}
                checked={rowCount > 0 && numSelected === rowCount}
                onChange={onSelectAllClick}
                inputProps={{
                  'aria-label': 'select all desserts',
                }}
              />
            </TableCell>
        }
        {
          map(columns, (headCell, idx) => {
            let label = '';
            if(headCell.label)
              label += headCell.label || ''
            else if(headCell.labelKey)
              label += t(headCell.labelKey)
            return (
              <TableCell
                key={idx}
                align={headCell.align || 'left'}
                padding='normal'
                sortDirection={orderBy === headCell.id ? order : false}
                sx={{background: 'inherit', ...headCell.sx}}
              >
                <TableSortLabel
                  active={orderBy === headCell.id}
                  direction={orderBy === headCell.id ? order : 'asc'}
                  onClick={headCell?.sortable === false ? undefined : createSortHandler(headCell.sortBy ? headCell.sortBy : headCell.id)}
                >
                  <b>{label}</b>
                  {
                    orderBy === headCell.id ? (
                      <Box component="span" sx={visuallyHidden}>
                        {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                      </Box>
                    ) : null
                  }
                </TableSortLabel>
              </TableCell>
            )
          })}
      </TableRow>
    </TableHead>
  );
}

const TableResults = ({selected, bgColor, handleClick, handleRowClick, handleSelectAllClick, results, resource, nested, isSelected, isItemShown, order, orderBy, className, style, onOrderByChange, selectedToShowItem, size, excludedColumns, extraColumns, properties, propertyFilters, loading, noHeader}) => {
  const rows = results?.results || []
  const getValue = (row, column) => {
    let val = get(row, column.value)
    if(column.formatter)
      return column.formatter(val)
    if(column.renderer)
      return column.renderer(row, Boolean(selectedToShowItem))
    return val
  }

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    onOrderByChange(property, isAsc ? 'desc' : 'asc')
  };

  let columns = filter(
    ALL_COLUMNS[resource] || [],
    column => nested ? column.nested !== false : column.global !== false
  );
  if(extraColumns?.length)
    columns = [...columns, ...extraColumns]

  columns = excludedColumns?.length ? reject(columns, column => excludedColumns?.includes(column.id)) : columns

  if(properties?.length) {
    columns = reject(columns, {property: true})
    const variableColumnIds = columns.map(col => col.id)
    let customProperties = reject(properties, property => variableColumnIds.includes(property))
    customProperties.forEach(property => {
      columns.push({
        id: property,
        label: startCase(property),
        className: 'searchable',
        sortable: Boolean(find(propertyFilters, {code: property})),
        sortBy: `properties.${property}.keyword`,
        renderer: item => {
          let prop = find(item.property, {code: property})
          if(prop) {
            let k = get(without(keys(prop), 'code'), '0')
            return get(prop, k)
          }
          return undefined
        }
      })
    })

    columns = sortBy(columns, column => {
      const idx = properties.indexOf(column.id);
      if(idx === -1)
        return properties.length
      column.isProperty = true
      return idx
    });
    columns = [...filter(columns, {permanent: true}), ...reject(columns, {permanent: true})]
  } else {
    columns = columns.map(column => {
      column.isProperty = false
      return column
    })
  }

  return (
    <TableContainer style={style || {height: 'calc(var(--app-height) - 275px)'}} className={className}>
      <Table
        stickyHeader
        size={size || 'small'}
        sx={{'.MuiTableCell-head': {lineHeight: '1.2rem', padding: '3px 16px'}}}
      >
        {
        !noHeader &&
            <EnhancedTableHead
              size={size}
              bgColor={bgColor}
              numSelected={selected.length}
              order={order}
              orderBy={orderBy}
              onSelectAllClick={handleSelectAllClick}
              onRequestSort={handleRequestSort}
              rowCount={rows.length || 0}
              resource={resource}
              columns={columns}
            />
        }
        <TableBody>
          {
            loading ?
              times(25, i => (
                <TableRow key={i}>
                  {
                    handleClick &&
                      <TableCell>
                        <Skeleton height={33} sx={{'-webkit-transform': 'none', 'transform': 'none'}} />
                      </TableCell>
                  }
                  {
                    columns.map((col, idx) => (
                      <TableCell key={idx}>
                        <Skeleton height={33} sx={{'-webkit-transform': 'none', 'transform': 'none'}} />
                      </TableCell>
                    ))
                  }
                </TableRow>
              )) :
              (

                rows.map((row, index) => {
                  const id = row.version_url || row.url || row.id
                  const isItemSelected = isSelected(id);
                  const isItemSelectedToShow = isItemShown(id)
                  const labelId = `enhanced-table-checkbox-${index}`;
                  const color = row.retired ? SECONDARY_COLORS.main : 'none'
                  let bgColor = isItemSelectedToShow ? 'primary.90' : ''

                  return (
                    <TableRow
                      hover
                      role="checkbox"
                      aria-checked={isItemSelectedToShow}
                      tabIndex={-1}
                      key={id}
                      onClick={event => handleRowClick(event, id)}
                      selected={isItemSelectedToShow}
                      className={isItemSelectedToShow ? 'show-item' : ''}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: '#FFF',
                        '&.Mui-selected': {
                          backgroundColor: bgColor
                        },
                        '&.MuiTableRow-hover:hover': {
                          backgroundColor: isItemSelectedToShow ? bgColor : 'primary.95'
                        },
                      }}
                    >
                      {
                        handleClick &&
                          <TableCell padding="checkbox" onClick={event => handleClick(event, id)} style={{color: color}}>
                            <Checkbox
                              size={size || 'medium'}
                              color="primary"
                              checked={isItemSelected}
                              inputProps={{
                                'aria-labelledby': labelId,
                              }}
                            />
                          </TableCell>
                      }
                      {
                        columns.map((column, idx) => {
                          const value = getValue(row, column)
                          return idx === 0  ?
                            <TableCell
                              key={idx}
                              component="th"
                              id={labelId}
                              scope="row"
                              padding="normal"
                              className={column.className}
                              sx={{color: color, ...column.sx}}
                            >
                              {value}
                            </TableCell>:
                          <TableCell key={idx} align={column.align || "left"} className={column.className} sx={{color: color, ...column.sx}}>
                            {value}
                          </TableCell>
                        })
                      }
                    </TableRow>
                  );
                })

              )
          }
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default TableResults;
