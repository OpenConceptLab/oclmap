import React from 'react'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import { Avatar as MuiAvatar } from '@mui/material'
import { PRIMARY_COLORS } from '../../common/colors'
import { toV3URL } from '../../common/utils'

const PRIMARY_STYLE = {
  backgroundColor: `${PRIMARY_COLORS['95']} !important`,
  '&:hover': {
    backgroundColor: `${PRIMARY_COLORS['95']} !important`,
    textDecoration: 'none !important'
  },
  '&:active': {
    outline: 'none',
    outlineOffset: 0,
    textDecoration: 'none !important'
  }
}

const SECONDARY_STYLE = {
  backgroundColor: "#FFF",
  '&:hover': {
    backgroundColor: `${PRIMARY_COLORS['95']} !important`,
    textDecoration: 'none !important'
  },
  '&:active': {
    outline: 'none',
    outlineOffset: 0,
    textDecoration: 'none !important'
  }
}


const ENTITY_CHIP_SIZE_MAP = {
  'medium': {
    height: '36px',
    fontSize: '14px',
    padding: '8px 12px',
    '.MuiChip-label': {
      paddingLeft: 0,
    },
    '.MuiAvatar-root': {
      width: '18px',
      height: '18px',
      margin: '1px 6px 1px 0',
      backgroundColor: 'transparent'
    },
    '.MuiSvgIcon-root': {
      color: '#000',
      fontSize: '18px'
    },
    '.divider-span': {
      width: '3px',
      height: '3px',
      backgroundColor: 'secondary.main',
      margin: '0 8px',
      borderRadius: '100px',
      opacity: 0.8,
    },
    '.entity-type': {
      color: 'secondary.main',
    },
    '.entity-name': {
      color: '#000',
    },
    '.entity-id': {
      color: '#000',
    }
  },
  'small': {
    height: '28px',
    fontSize: '12px',
    padding: '4px 12px',
    '.MuiChip-label': {
      paddingLeft: 0,
      paddingTop: '3px',
    },
    '.MuiAvatar-root': {
      width: '16px',
      height: '16px',
      margin: '0 6px 0 0',
      backgroundColor: 'transparent',
    },
    '.MuiSvgIcon-root': {
      color: '#000',
      fontSize: '16px'
    },
    '.divider-span': {
      width: '3px',
      height: '3px',
      backgroundColor: 'secondary.main',
      margin: '0 8px',
      borderRadius: '100px',
      opacity: 0.8,
    },
    '.entity-type': {
      color: 'secondary.main',
    },
    '.entity-name': {
      color: '#000',
    },
    '.entity-id': {
      color: '#000',
    }
  },
}

const Avatar = ({ entity, icon }) => {
  return entity?.logo_url ? (
    <MuiAvatar alt={entity.name || entity.id || entity.username} src={entity.logo_url} />
  ) :
    <MuiAvatar>
      {icon}
    </MuiAvatar>
}

const Label = ({ entity, hideType, isVersion }) => {
  return (
    <span style={{display: 'flex', alignItems: 'center'}} className='entity-label'>
      <span className='entity-id'>
        <b>{entity?.short_code || entity?.id || entity?.username}</b>
      </span>
      {
        isVersion &&
          <React.Fragment>
            <span className='divider-span' />
            <span className='entity-type'>
              {entity.version || entity.id}
            </span>
          </React.Fragment>

      }
      {
        (entity?.type?.includes('Concept') && entity?.display_name) &&
          <span className='entity-name' style={{marginLeft: '4px'}}>
            {entity.display_name}
          </span>
      }
      {
        !hideType &&
          <React.Fragment>
            <span className='divider-span' />
            <span className='entity-type'>
              {entity?.type ? entity.type : <Skeleton variant='text' width={40} />}
            </span>
          </React.Fragment>
      }
    </span>
  )
}


const BaseEntityChip = ({ entity, icon, hideType, primary, size, sx, noLink, isVersion, ...rest }) => {
  const sizeStyle = ENTITY_CHIP_SIZE_MAP[size || 'medium'] || ENTITY_CHIP_SIZE_MAP.medium
  const baseStyle = primary ? PRIMARY_STYLE : SECONDARY_STYLE
  return (
    <Chip
      avatar={<Avatar entity={entity} icon={icon} />}
      label={<Label entity={entity} hideType={hideType} isVersion={isVersion} />}
      variant='outlined'
      sx={{
        borderRadius: '4px',
        minWidth: '95px',
        border: '1px solid',
        borderColor: 'surface.nv80',
        justifyContent: 'flex-start',
        ...baseStyle,
        ...sizeStyle,
        ...sx
      }}
      onClick={noLink ? undefined : event => {
        event.stopPropagation()
      }}
      href={noLink ? undefined : toV3URL(entity?.version_url || entity?.url)}
      component='a'
      target='_blank'
      rel='noreferrer noopener'
      {...rest}
    />
  )
}

export default BaseEntityChip;
