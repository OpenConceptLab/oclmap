import React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';

import { map, startCase } from 'lodash';
import DownIcon from '@mui/icons-material/ArrowDownward';
import UpIcon from '@mui/icons-material/ArrowUpward';

const SortMenu = ({anchorEl, labelId, onClose, order, orderBy, onChange, fields}) => {
  const _onChange = (newOrderBy, newOrder) => {
    onChange(newOrderBy, newOrder)
    onClose()
  }
  let _order = order || 'desc'
  let _orderBy = orderBy || 'score'
  return (
    <Menu
      id="basic-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      slotProps={{
        list: {'aria-labelledby': labelId},
      }}
      sx={{
        '& .MuiList-root': {minWidth: '225px'}
      }}
    >
      {
        map(fields, field => {
          let label = startCase(field)
          return ['desc', 'asc'].map(orderType => (
            <MenuItem key={`${field}-${orderType}`} selected={_orderBy?.toLowerCase() === field?.toLowerCase() && _order === orderType} onClick={() => _onChange(field?.toLowerCase(), orderType)}>
              <ListItemText>{label}</ListItemText>
              {orderType === 'desc' ? <DownIcon />  : <UpIcon />}
            </MenuItem>
          ))
        })
      }
    </Menu>
  )
}

export default SortMenu;
